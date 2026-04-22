'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Clock3,
  LineChart,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdvancedStatistics } from '@/features/dsw/hooks';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { DSWTrendGranularity } from '@/features/dsw/types';
import { DSWStatisticsShimmer } from '@/components/shimmer';

const RANGE_OPTIONS = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
  { label: '24M', value: 24 },
] as const;

const GRANULARITY_OPTIONS: { label: string; value: DSWTrendGranularity }[] = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];

const toPercent = (value: number) => `${value.toFixed(1)}%`;

export default function StatisticsPage() {
  const [rangeMonths, setRangeMonths] = useState<number>(6);
  const [granularity, setGranularity] = useState<DSWTrendGranularity>('monthly');

  const { data: response, isLoading, isFetching, error } = useAdvancedStatistics({
    rangeMonths,
    granularity,
  });

  const analytics = response?.success ? response.data : null;
  const overview = analytics?.overview;

  const topActiveClubs = analytics?.topActiveClubs ?? [];
  const clubPerformance = analytics?.clubPerformance ?? [];
  const highPerformingEvents = analytics?.eventPerformance?.highPerforming ?? [];
  const growthTrend = analytics?.clubGrowth?.overall ?? [];

  const trendData = useMemo(() => {
    return analytics?.trends?.primary ?? [];
  }, [analytics]);

  const errorMessage = error ? getErrorMessage(error) : null;

  if (isLoading) {
    return <DSWStatisticsShimmer />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ev-900">Club Intelligence Dashboard</h1>
          <p className="mt-2 text-ev-400">University-level analytics for club performance and event participation</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center rounded-xl border border-[#b3cde0]/70 bg-white p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRangeMonths(option.value)}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                  rangeMonths === option.value
                    ? 'bg-ev-700 text-white'
                    : 'text-ev-500 hover:bg-ev-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-xl border border-[#b3cde0]/70 bg-white p-1">
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setGranularity(option.value)}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                  granularity === option.value
                    ? 'bg-[#011f4b] text-white'
                    : 'text-ev-500 hover:bg-ev-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}

      {isFetching && (
        <div className="rounded-lg bg-ev-50 border border-[#b3cde0]/70 p-3 text-xs text-ev-600 flex items-center gap-2">
          <Clock3 className="w-4 h-4" />
          Updating analytics for the selected range...
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 sm:gap-6">
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Total Clubs</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">{overview?.totalClubs || 0}</p>
              <p className="text-xs text-ev-400 mt-1">{overview?.activeClubs || 0} active</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><Users className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Members</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">{overview?.totalMembers || 0}</p>
              <p className="text-xs text-ev-400 mt-1">{overview?.activeMembers || 0} active</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><TrendingUp className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Events in Window</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">{overview?.totalEvents || 0}</p>
              <p className="text-xs text-ev-400 mt-1">Last {rangeMonths} months</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><Calendar className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Participants</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">{overview?.totalParticipants || 0}</p>
              <p className="text-xs text-ev-400 mt-1">{overview?.totalAttended || 0} attended</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><Activity className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Attendance Rate</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">
                {toPercent(overview?.averageAttendanceRate || 0)}
              </p>
              <p className="text-xs text-ev-400 mt-1">Across tracked events</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><LineChart className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Event Lifecycle</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">
                {(overview?.eventStatusSummary?.upcoming || 0) + (overview?.eventStatusSummary?.ongoing || 0) + (overview?.eventStatusSummary?.past || 0)}
              </p>
              <p className="text-xs text-ev-400 mt-1">
                {overview?.eventStatusSummary?.upcoming || 0} up • {overview?.eventStatusSummary?.ongoing || 0} on
              </p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><Sparkles className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
      </div>

      {/* Trend Wall */}
      {trendData.length > 0 && (
        <div className="ev-card">
          <div className="px-6 py-4 border-b border-[#b3cde0]/40">
            <h2 className="ev-section-title">Participation Trends ({granularity})</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={trendData} margin={{ left: 10, right: 10, top: 16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6e6ef" />
                  <XAxis dataKey="label" stroke="#5d7f95" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" stroke="#5d7f95" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#5d7f95" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: '#b3cde0' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'attendanceRate') return [`${value}%`, 'Attendance'];
                      return [value, name === 'participants' ? 'Participants' : 'Events'];
                    }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="events" stroke="#005b96" strokeWidth={3} dot={false} name="events" />
                  <Line yAxisId="right" type="monotone" dataKey="participants" stroke="#03396c" strokeWidth={2.5} dot={false} name="participants" />
                  <Line yAxisId="left" type="monotone" dataKey="attendanceRate" stroke="#6497b1" strokeWidth={2} dot={false} name="attendanceRate" />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="ev-card">
          <div className="px-6 py-4 border-b border-[#b3cde0]/40 flex items-center justify-between">
            <h2 className="ev-section-title">Most Active Clubs</h2>
            <span className="text-xs text-ev-400">Ranked by events and participation</span>
          </div>
          <div className="p-4 sm:p-6">
            {topActiveClubs.length === 0 ? (
              <p className="text-sm text-ev-500">No club activity found in this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-ev-500 border-b border-[#e2edf3]">
                      <th className="py-2 pr-3">Club</th>
                      <th className="py-2 pr-3">Events</th>
                      <th className="py-2 pr-3">Participants</th>
                      <th className="py-2 pr-3">Attendance</th>
                      <th className="py-2">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topActiveClubs.map((club) => (
                      <tr key={club.clubId} className="border-b border-[#edf4f8] last:border-0">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-ev-900">{club.clubName}</p>
                          <p className="text-xs text-ev-500">{club.clubCode}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-ev-800">{club.eventsCount}</td>
                        <td className="py-2.5 pr-3 text-ev-800">{club.participants}</td>
                        <td className="py-2.5 pr-3 text-ev-800">{toPercent(club.attendanceRate)}</td>
                        <td className="py-2.5 text-ev-900 font-semibold">{club.engagementScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="ev-card">
          <div className="px-6 py-4 border-b border-[#b3cde0]/40">
            <h2 className="ev-section-title">High-Performing Events</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-ev-50 p-3 border border-[#d6e6ef]">
                <p className="text-xs text-ev-500">Upcoming</p>
                <p className="text-xl font-semibold text-ev-900">{overview?.eventStatusSummary?.upcoming || 0}</p>
              </div>
              <div className="rounded-lg bg-ev-50 p-3 border border-[#d6e6ef]">
                <p className="text-xs text-ev-500">Ongoing</p>
                <p className="text-xl font-semibold text-ev-900">{overview?.eventStatusSummary?.ongoing || 0}</p>
              </div>
              <div className="rounded-lg bg-ev-50 p-3 border border-[#d6e6ef]">
                <p className="text-xs text-ev-500">Past</p>
                <p className="text-xl font-semibold text-ev-900">{overview?.eventStatusSummary?.past || 0}</p>
              </div>
            </div>

            {highPerformingEvents.length === 0 ? (
              <p className="text-sm text-ev-500">No high-performing events yet in this window.</p>
            ) : (
              <div className="space-y-2">
                {highPerformingEvents.slice(0, 6).map((event) => (
                  <div key={event.eventId} className="rounded-lg border border-[#dbeaf1] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ev-900 leading-tight">{event.name}</p>
                        <p className="text-xs text-ev-500 mt-1">{event.eventCode} • {event.timeline}</p>
                      </div>
                      <span className="text-sm font-semibold text-ev-900">{event.engagementScore}</span>
                    </div>
                    <div className="mt-2 text-xs text-ev-600 flex gap-3 flex-wrap">
                      <span>{event.registrations} registrations</span>
                      <span>{toPercent(event.attendanceRate)} attendance</span>
                      <span>{event.averageFeedback.toFixed(1)}/10 feedback</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {clubPerformance.length > 0 && (
        <div className="ev-card">
          <div className="px-6 py-4 border-b border-[#b3cde0]/40">
            <h2 className="ev-section-title">Club Performance Matrix</h2>
          </div>
          <div className="p-4 sm:p-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-ev-500 border-b border-[#e2edf3]">
                  <th className="py-2 pr-4">Club</th>
                  <th className="py-2 pr-4">Members</th>
                  <th className="py-2 pr-4">Events</th>
                  <th className="py-2 pr-4">Participation</th>
                  <th className="py-2 pr-4">Growth</th>
                  <th className="py-2">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {clubPerformance.map((club) => {
                  const activeRatio = club.totalMembers > 0
                    ? (club.activeMembers / club.totalMembers) * 100
                    : 0;

                  return (
                    <tr key={club.clubId} className="border-b border-[#edf4f8] last:border-0 align-top">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-ev-900">{club.clubName}</p>
                        <p className="text-xs text-ev-500">{club.categoryName}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-ev-900 font-medium">{club.totalMembers}</p>
                        <div className="mt-1 w-28 h-1.5 bg-ev-100 rounded-full overflow-hidden">
                          <div className="h-full bg-ev-700" style={{ width: `${Math.min(activeRatio, 100)}%` }} />
                        </div>
                        <p className="text-xs text-ev-500 mt-1">{club.activeMembers} active</p>
                      </td>
                      <td className="py-3 pr-4 text-ev-800">{club.eventsCount}</td>
                      <td className="py-3 pr-4">
                        <p className="text-ev-800">{club.participants} total</p>
                        <p className="text-xs text-ev-500">{toPercent(club.attendanceRate)} attendance</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-ev-800">+{club.growthNewMembers}</p>
                        <p className="text-xs text-ev-500">{toPercent(club.growthRate)} of members</p>
                      </td>
                      <td className="py-3 text-ev-900 font-semibold">{club.engagementScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {growthTrend.length > 0 && (
        <div className="ev-card">
          <div className="px-6 py-4 border-b border-[#b3cde0]/40">
            <h2 className="ev-section-title">Club Growth Over Time</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthTrend} margin={{ left: 10, right: 10, top: 16, bottom: 8 }}>
                  <defs>
                    <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#005b96" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#005b96" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6e6ef" />
                  <XAxis dataKey="label" stroke="#5d7f95" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#5d7f95" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#b3cde0' }} />
                  <Legend />
                  <Area type="monotone" dataKey="cumulativeMembers" stroke="#005b96" fill="url(#growthGradient)" strokeWidth={2.5} name="cumulativeMembers" />
                  <Line type="monotone" dataKey="newMembers" stroke="#03396c" strokeWidth={2} dot={false} name="newMembers" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {clubPerformance.length === 0 && (
        <div className="ev-card p-12 text-center">
          <BarChart3 className="w-14 h-14 text-ev-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ev-900 mb-2">No Analytics Available</h3>
          <p className="text-ev-400 text-sm">
            No event or participation data was found for the selected time range.
          </p>
        </div>
      )}
    </div>
  );
}
