'use client';

import React from 'react';
import {
  Users, UserCheck, Clock, UserX, Activity, Shield,
  IndianRupee, Target, TrendingUp, TrendingDown,
  PieChart, BarChart3, LogIn, LogOut, Eye, Zap, Percent,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend,
} from 'recharts';
import type { Event, EventStatistics, EventVolunteer } from '@/features/event-management/types/event.types';
import { CARD, CARD_HEADER, METRIC_CARD, STATUS_COLORS } from './constants';

// ── Metric Card ──────────────────────────────────────────────────
const MetricCard = ({
  icon: Icon,
  iconBg,
  label,
  value,
  subtitle,
  trend,
}: {
  icon: React.ElementType;
  iconBg: string;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: string; positive: boolean } | null;
}) => (
  <div className={METRIC_CARD}>
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2.5 rounded-lg ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      {trend && (
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend.positive
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend.value}
        </span>
      )}
    </div>
    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{subtitle}</p>}
  </div>
);

// ── Props ────────────────────────────────────────────────────────
interface OverviewTabProps {
  event: Event;
  statistics: EventStatistics;
  volunteers: EventVolunteer[];
  capacityUsage: number | null;
  confirmationRate: number;
  attendanceRate: number;
  trendData: { date: string; daily: number; cumulative: number }[];
  pieData: { name: string; value: number; color: string }[];
}

export default function OverviewTab({
  event,
  statistics,
  volunteers,
  capacityUsage,
  confirmationRate,
  attendanceRate,
  trendData,
  pieData,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={Users}
          iconBg="bg-sgt-50 text-sgt-600 dark:bg-sgt-900/30 dark:text-sgt-400"
          label="Total Registrations"
          value={statistics.totalRegistrations}
          subtitle={capacityUsage ? `${capacityUsage}% of capacity` : undefined}
        />
        <MetricCard
          icon={UserCheck}
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          label="Confirmed"
          value={statistics.confirmedRegistrations}
          trend={{ value: `${confirmationRate}%`, positive: confirmationRate >= 50 }}
        />
        <MetricCard
          icon={Clock}
          iconBg="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          label="Pending"
          value={statistics.pendingRegistrations}
        />
        <MetricCard
          icon={UserX}
          iconBg="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          label="Cancelled"
          value={statistics.cancelledRegistrations}
        />
        <MetricCard
          icon={Activity}
          iconBg="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          label="Attended"
          value={statistics.totalAttended}
          trend={{ value: `${attendanceRate}%`, positive: attendanceRate >= 50 }}
        />
        <MetricCard
          icon={Shield}
          iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          label="Volunteers"
          value={volunteers.length}
        />
      </div>

      {/* Revenue + Capacity Row (conditional) */}
      {(event.paymentType === 'paid' || event.maxCapacity) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {event.paymentType === 'paid' && (
            <div className={METRIC_CARD}>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-sgt-500 to-sgt-700 text-white">
                  <IndianRupee className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    ₹{statistics.totalRevenue?.toLocaleString('en-IN') || 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Fee: ₹{event.registrationFee?.toLocaleString('en-IN') || 0} × {statistics.confirmedRegistrations} confirmed
                  </p>
                </div>
              </div>
            </div>
          )}
          {event.maxCapacity && (
            <div className={METRIC_CARD}>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                  <Target className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Capacity</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {statistics.totalRegistrations} / {event.maxCapacity}
                  </p>
                  <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sgt-400 to-sgt-600 transition-all duration-500"
                      style={{ width: `${Math.min(Number(capacityUsage || 0), 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {Number(capacityUsage || 0) >= 90 ? '⚠️ Almost full' : `${capacityUsage}% filled`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Trend */}
        <div className={`${CARD} lg:col-span-2 overflow-hidden`}>
          <div className={CARD_HEADER}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sgt-500" />
              Registration Trend
            </h3>
          </div>
          <div className="p-4 h-[280px]">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F2573" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0F2573" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4BBAF2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4BBAF2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 14px rgba(4,29,86,0.15)',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="#0F2573" strokeWidth={2} fill="url(#colorCum)" name="Cumulative" />
                  <Area type="monotone" dataKey="daily" stroke="#4BBAF2" strokeWidth={2} fill="url(#colorDaily)" name="Daily" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No registration data yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Breakdown Pie */}
        <div className={`${CARD} overflow-hidden`}>
          <div className={CARD_HEADER}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-sgt-500" />
              Status Breakdown
            </h3>
          </div>
          <div className="p-4 h-[280px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>
                    )}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <PieChart className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No status data</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Entry/Exit + Conversion Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Attendance Ring */}
        <div className={`${CARD} overflow-hidden`}>
          <div className={CARD_HEADER}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-sgt-500" />
              Attendance Rate
            </h3>
          </div>
          <div className="p-6 flex flex-col items-center">
            <div className="relative w-32 h-32 mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
                <circle
                  cx="64" cy="64" r="56"
                  stroke="url(#attendGrad)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - attendanceRate / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="attendGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0F2573" />
                    <stop offset="100%" stopColor="#4BBAF2" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{attendanceRate}%</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Attended</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {statistics.totalAttended} of {statistics.totalRegistrations} registered
            </p>
          </div>
        </div>

        {/* Entry/Exit Card */}
        <div className={`${CARD} overflow-hidden`}>
          <div className={CARD_HEADER}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-sgt-500" />
              Entry &amp; Exit
            </h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <LogIn className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{statistics.totalEntries || 0}</p>
                <p className="text-[10px] text-gray-500 uppercase">Entries</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <LogOut className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{statistics.totalExits || 0}</p>
                <p className="text-[10px] text-gray-500 uppercase">Exits</p>
              </div>
              <div className="p-3 bg-sgt-50 dark:bg-sgt-900/20 rounded-lg">
                <Eye className="w-5 h-5 text-sgt-600 dark:text-sgt-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-sgt-600 dark:text-sgt-400">{statistics.currentlyInside || 0}</p>
                <p className="text-[10px] text-gray-500 uppercase">Inside</p>
              </div>
            </div>
            {(statistics.totalEntries || 0) > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Entry flow</span>
                  <span>
                    {(statistics.totalExits || 0) > 0
                      ? (((statistics.totalExits || 0) / (statistics.totalEntries || 1)) * 100).toFixed(0)
                      : 0}% exited
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{
                      width: `${(statistics.totalEntries || 0) > 0
                        ? (((statistics.totalEntries || 0) - (statistics.totalExits || 0)) / (statistics.totalEntries || 1)) * 100
                        : 0}%`,
                    }}
                  />
                  <div
                    className="bg-red-400 h-full"
                    style={{
                      width: `${(statistics.totalEntries || 0) > 0
                        ? ((statistics.totalExits || 0) / (statistics.totalEntries || 1)) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className={`${CARD} overflow-hidden`}>
          <div className={CARD_HEADER}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Percent className="w-4 h-4 text-sgt-500" />
              Conversion Funnel
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {[
              { label: 'Registered', value: statistics.totalRegistrations, pct: 100, color: 'bg-sgt-500' },
              {
                label: 'Confirmed',
                value: statistics.confirmedRegistrations,
                pct: statistics.totalRegistrations > 0  ? (statistics.confirmedRegistrations / statistics.totalRegistrations) * 100 : 0,
                color: 'bg-emerald-500',
              },
              {
                label: 'Attended',
                value: statistics.totalAttended,
                pct: statistics.totalRegistrations > 0 ? (statistics.totalAttended / statistics.totalRegistrations) * 100 : 0,
                color: 'bg-purple-500',
              },
            ].map((step) => (
              <div key={step.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{step.label}</span>
                  <span className="text-gray-500">{step.value} ({step.pct.toFixed(0)}%)</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${step.color} transition-all duration-700`} style={{ width: `${step.pct}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 text-center">
                Overall Conversion:{' '}
                <span className="font-bold text-gray-700 dark:text-gray-300">
                  {statistics.totalRegistrations > 0
                    ? ((statistics.totalAttended / statistics.totalRegistrations) * 100).toFixed(1)
                    : 0}%
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
