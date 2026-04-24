'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3, Activity, TrendingUp, Zap, Award,
  Mail, CheckCircle2, AlertCircle, Loader2,
  Users, Send, MailOpen,
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { eventService } from '@/features/event-management/services/event.service';
import type { EventStatistics, EventVolunteer } from '@/features/event-management/types/event.types';
import { CARD, CARD_HEADER } from './constants';
import { ShimmerStatCard, ShimmerCard, ShimmerLine } from '@/components/shimmer';

type EmailAnalyticsData = {
  totalCampaigns: number;
  scheduledPending: number;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalDelivered: number;
  deliveryRate: number;
  openRate: number;
  recentCampaigns: Array<{
    id: string;
    subject: string;
    sentAt: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    status: string;
  }>;
};

// ── Props ────────────────────────────────────────────────────────
interface AnalyticsTabProps {
  eventId: string;
  statistics: EventStatistics;
  trendData: { date: string; daily: number; cumulative: number }[];
  confirmationRate: number;
  attendanceRate: number;
  volunteers: EventVolunteer[];
}

export default function AnalyticsTab({
  eventId,
  statistics,
  trendData,
  confirmationRate,
  attendanceRate,
  volunteers,
}: AnalyticsTabProps) {
  const [emailAnalytics, setEmailAnalytics] = useState<EmailAnalyticsData | null>(null);
  const [emailAnalyticsLoading, setEmailAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (!eventId || emailAnalytics) return;
    setEmailAnalyticsLoading(true);
    eventService.getEmailAnalytics(eventId)
      .then(setEmailAnalytics)
      .catch(() => {})
      .finally(() => setEmailAnalyticsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return (
    <div className="space-y-6">
      {/* Daily Registrations Bar Chart */}
      <div className={`${CARD} overflow-hidden`}>
        <div className={CARD_HEADER}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-ev-700" />
            Daily Registrations
          </h3>
        </div>
        <div className="p-4 h-[320px]">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                <Bar dataKey="daily" fill="#0F2573" radius={[4, 4, 0, 0]} name="Registrations" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No daily data yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Registration Velocity */}
        <div className={`${CARD} overflow-hidden`}>
          <div className={CARD_HEADER}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-ev-700" />
              Registration Velocity
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {(() => {
              const days = trendData.length || 1;
              const avgPerDay = (statistics.totalRegistrations / days).toFixed(1);
              const peakDay = trendData.reduce((max, d) => (d.daily > max.daily ? d : max), trendData[0] || { date: 'N/A', daily: 0 });
              return (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Avg / Day</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{avgPerDay}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Peak Day</span>
                    <span className="text-sm font-semibold text-ev-700 dark:text-ev-400">{peakDay.date} ({peakDay.daily})</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Total Days</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{days}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Registration Health */}
        <div className={`${CARD} overflow-hidden`}>
          <div className={CARD_HEADER}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-ev-700" />
              Registration Health
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: 'Confirmation Rate', value: confirmationRate, color: confirmationRate >= 70 ? 'text-emerald-600' : confirmationRate >= 40 ? 'text-amber-600' : 'text-red-600' },
              { label: 'Attendance Rate', value: attendanceRate, color: attendanceRate >= 70 ? 'text-emerald-600' : attendanceRate >= 40 ? 'text-amber-600' : 'text-red-600' },
              {
                label: 'Cancellation Rate',
                value: statistics.totalRegistrations > 0 ? Number(((statistics.cancelledRegistrations / statistics.totalRegistrations) * 100).toFixed(1)) : 0,
                color: 'text-red-500',
              },
            ].map((metric) => (
              <div key={metric.label} className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</span>
                <span className={`text-lg font-bold ${metric.color}`}>{metric.value}%</span>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {confirmationRate >= 60 && attendanceRate >= 40 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-emerald-600 font-medium">Healthy event metrics</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-600 font-medium">Some metrics need attention</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Event Score Card */}
        <div className={`${CARD} overflow-hidden`}>
          <div className={CARD_HEADER}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-ev-700" />
              Event Score
            </h3>
          </div>
          <div className="p-5 flex flex-col items-center">
            {(() => {
              let score = 0;
              if (statistics.totalRegistrations > 0) score += 20;
              if (statistics.totalRegistrations >= 10) score += 10;
              if (confirmationRate >= 50) score += 20;
              if (confirmationRate >= 80) score += 10;
              if (attendanceRate >= 30) score += 15;
              if (attendanceRate >= 60) score += 10;
              if (volunteers.length >= 1) score += 10;
              if (statistics.cancelledRegistrations / Math.max(statistics.totalRegistrations, 1) < 0.2) score += 5;
              score = Math.min(score, 100);
              const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
              const gradeColor = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-ev-700' : score >= 40 ? 'text-amber-500' : 'text-red-500';
              return (
                <>
                  <div className={`text-5xl font-black ${gradeColor} mb-1`}>{grade}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">{score}/100 points</div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-ev-700' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Based on registrations, confirmation, attendance &amp; team
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Email Analytics Card */}
      <div className={`${CARD} overflow-hidden`}>
        <div className={CARD_HEADER}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-violet-500" />
            Email Analytics
          </h3>
        </div>
        {emailAnalyticsLoading ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <ShimmerCard key={i} className="p-3">
                  <ShimmerLine className="h-6 w-12 mb-1" />
                  <ShimmerLine className="h-3 w-16" />
                </ShimmerCard>
              ))}
            </div>
          </div>
        ) : !emailAnalytics || emailAnalytics.totalCampaigns === 0 ? (
          <div className="p-8 text-center">
            <Mail className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400">No emails sent yet for this event</p>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Campaigns', value: emailAnalytics.totalCampaigns, sub: emailAnalytics.scheduledPending > 0 ? `${emailAnalytics.scheduledPending} scheduled` : 'total sent', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20', icon: Send },
                { label: 'Recipients', value: emailAnalytics.totalRecipients.toLocaleString(), sub: `${emailAnalytics.totalSent.toLocaleString()} emails out`, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Users },
                { label: 'Delivery Rate', value: `${emailAnalytics.deliveryRate}%`, sub: `${emailAnalytics.totalDelivered} delivered`, color: emailAnalytics.deliveryRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : emailAnalytics.deliveryRate >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500', bg: emailAnalytics.deliveryRate >= 90 ? 'bg-emerald-50 dark:bg-emerald-900/20' : emailAnalytics.deliveryRate >= 70 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20', icon: CheckCircle2 },
                { label: 'Open Rate', value: `${emailAnalytics.openRate}%`, sub: `${emailAnalytics.totalOpened} unique opens`, color: emailAnalytics.openRate >= 25 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400', bg: emailAnalytics.openRate >= 25 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20', icon: MailOpen },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-lg p-3`}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5">{s.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
            {emailAnalytics.recentCampaigns.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Recent Campaigns</p>
                <div className="space-y-2">
                  {emailAnalytics.recentCampaigns.map((c) => {
                    const rate = c.recipientCount > 0 ? Math.round((c.sentCount / c.recipientCount) * 100) : 0;
                    const sc = c.status ===
   'sent' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : c.status ===
   'partial' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' : 'text-red-600 bg-red-50 dark:bg-red-900/30';
                    return (
                      <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{c.subject}</p>
                          <p className="text-xs text-gray-400">{new Date(c.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{c.sentCount}/{c.recipientCount}</p>
                          <p className="text-xs text-gray-400">{rate}%</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${sc}`}>{c.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cumulative Growth Chart */}
      <div className={`${CARD} overflow-hidden`}>
        <div className={CARD_HEADER}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-ev-700" />
            Cumulative Growth
          </h3>
        </div>
        <div className="p-4 h-[280px]">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#266CA9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#266CA9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 14px rgba(4,29,86,0.15)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="cumulative" stroke="#266CA9" strokeWidth={2} fill="url(#growthGrad)" name="Total Registrations" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No growth data yet</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
