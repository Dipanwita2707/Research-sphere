'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  Eye,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { EventStatistics, EventPostReportSummary } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import StatsCard from './components/StatsCard';
import SponsorTable from './components/SponsorTable';
import RevenueChart from './components/RevenueChart';
import RecentRegistrationsTable from './components/RecentRegistrationsTable';
import StatusBreakdownList from './components/StatusBreakdownList';
import VolunteerLeaderboard from './components/VolunteerLeaderboard';
import FlowByHourChart from './components/FlowByHourChart';

const formatDays = (value: number | null | undefined) => {
  if (value == null) return 'N/A';
  if (value ===
   0) return 'Today';
  if (value > 0) return `In ${value} day${value ===
   1 ? '' : 's'}`;
  return `${Math.abs(value)} day${Math.abs(value) ===
   1 ? '' : 's'} ago`;
};

const getStatusTone = (status?: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized ===
   'published' || normalized ===
   'ongoing') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (normalized ===
   'completed') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (normalized ===
   'draft') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (normalized ===
   'cancelled') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

export default function EventStatisticsPage() {
  const params = useParams();
  const { toast } = useToast();
  const eventId = params.id as string;

  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [postReports, setPostReports] = useState<EventPostReportSummary[]>([]);
  const [loadingPostReports, setLoadingPostReports] = useState(true);

  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);
      const stats = await eventService.getStatistics(eventId);
      setStatistics(stats);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    void loadStatistics();
  }, [loadStatistics]);

  const loadPostReports = useCallback(async () => {
    try {
      setLoadingPostReports(true);
      const reportData = await eventService.getPostEventReports(eventId);
      const versions = Array.isArray(reportData?.versions) ? reportData.versions : [];
      const sorted = [...versions].sort((a, b) => b.version - a.version);
      setPostReports(sorted);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) || 'Failed to load post-event reports' });
      setPostReports([]);
    } finally {
      setLoadingPostReports(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    void loadPostReports();
  }, [loadPostReports]);

  const formatReportDate = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const formatFileSize = (size: number) => {
    if (!size || size <= 0) return '0 B';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const extensionFromReport = (report: EventPostReportSummary) => {
    const ext = report.originalFileName.split('.').pop()?.toLowerCase();
    if (ext) return `.${ext}`;
    if (report.mimeType === 'application/pdf') return '.pdf';
    if (report.mimeType === 'application/msword') return '.doc';
    if (report.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '.docx';
    return '';
  };

  const buildEventReportName = (report: EventPostReportSummary, eventName?: string) => {
    const cleanedEventName = String(eventName || 'event')
      .trim()
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event';
    return `${cleanedEventName}-post-event-report-v${report.version}${extensionFromReport(report)}`;
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadReport = async (report: EventPostReportSummary) => {
    try {
      const blob = await eventService.downloadPostEventReport(eventId, report.id);
      downloadBlob(blob, buildEventReportName(report, statistics?.eventSummary?.name));
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) || 'Failed to download report' });
    }
  };

  const handlePreviewReport = async (report: EventPostReportSummary) => {
    if (report.mimeType !== 'application/pdf') {
      toast({ type: 'error', message: 'Preview is available only for PDF reports' });
      return;
    }

    try {
      const blob = await eventService.previewPostEventReport(eventId, report.id);
      const previewUrl = window.URL.createObjectURL(blob);
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(previewUrl), 60 * 1000);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) || 'Failed to preview report' });
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const [stats] = await Promise.all([
        eventService.getStatistics(eventId),
        loadPostReports(),
      ]);
      setStatistics(stats);
      toast({ type: 'success', message: 'Statistics refreshed' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setRefreshing(false);
    }
  };

  const event = statistics?.eventSummary;
  const sponsorship = statistics?.sponsorship;
  const participation = statistics?.participationMetrics;
  const insights = statistics?.eventInsights;
  const funnel = statistics?.registrationFunnel;
  const paymentMetrics = statistics?.paymentMetrics;
  const capacity = statistics?.capacityInsights;
  const demographics = statistics?.participantDemographics;
  const volunteerInsights = statistics?.volunteerInsights;
  const teamInsights = statistics?.teamInsights;
  const notingAndCustom = statistics?.notingAndCustomData;

  const filteredRecentRegistrations = useMemo(() => {
    const rows = statistics?.recentRegistrations || [];
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const statusMatches = statusFilter ===
   'all' || row.status ===
   statusFilter;
      if (!statusMatches) return false;

      if (!normalizedSearch) return true;
      return (
        row.registrationId.toLowerCase().includes(normalizedSearch)
        || (row.user?.name || '').toLowerCase().includes(normalizedSearch)
        || (row.user?.uid || '').toLowerCase().includes(normalizedSearch)
        || (row.user?.email || '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [searchQuery, statistics?.recentRegistrations, statusFilter]);

  const paymentBreakdownItems = useMemo(() => (
    (paymentMetrics?.statusBreakdown || []).map((item) => ({
      label: item.status,
      count: item.count,
      percent: item.percent,
      amount: item.amount,
    }))
  ), [paymentMetrics?.statusBreakdown]);

  const roleBreakdownItems = useMemo(() => (
    (demographics?.byRole || []).map((item) => ({
      label: item.role,
      count: item.count,
      percent: item.percent,
    }))
  ), [demographics?.byRole]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ev-700" />
      </div>
    );
  }

  if (!statistics || !event) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-300">Unable to load event statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#b3cde0]/60 bg-gradient-to-r from-[#f7fbff] to-white p-5 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link
                href={`/events/${eventId}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#b3cde0] text-ev-700 hover:bg-[#f8fbff] dark:border-gray-700 dark:text-ev-300"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-xl font-bold text-ev-900 dark:text-white">Event Intelligence Dashboard</h1>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusTone(event.status)}`}>
                {event.status}
              </span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{event.name}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-[#e8f1f8] px-2.5 py-1 font-medium text-ev-800 dark:bg-gray-700 dark:text-gray-200">{event.eventId}</span>
              <span className="rounded-full bg-[#e8f1f8] px-2.5 py-1 font-medium capitalize text-ev-800 dark:bg-gray-700 dark:text-gray-200">{event.eventType}</span>
              <span className="rounded-full bg-[#e8f1f8] px-2.5 py-1 font-medium capitalize text-ev-800 dark:bg-gray-700 dark:text-gray-200">{event.paymentType}</span>
              {event.participationType ? (
                <span className="rounded-full bg-[#e8f1f8] px-2.5 py-1 font-medium capitalize text-ev-800 dark:bg-gray-700 dark:text-gray-200">
                  {event.participationType}
                </span>
              ) : null}
              {event.opportunityMode ? (
                <span className="rounded-full bg-[#e8f1f8] px-2.5 py-1 font-medium capitalize text-ev-800 dark:bg-gray-700 dark:text-gray-200">
                  {event.opportunityMode}
                </span>
              ) : null}
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-ev-700 px-4 py-2 text-sm font-medium text-white hover:bg-ev-800 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatsCard title="Total Registrations" value={statistics.totalRegistrations} icon={Users} />
        <StatsCard
          title="Confirmed"
          value={statistics.confirmedRegistrations}
          helper={`${funnel?.confirmationRate ?? 0}% confirmation`}
          icon={CheckCircle2}
          accentClassName="text-emerald-700 bg-emerald-50"
        />
        <StatsCard
          title="Drop-offs"
          value={participation?.dropOffRegistrations ?? statistics.cancelledRegistrations}
          helper={`${funnel?.dropOffRate ?? 0}% drop-off`}
          icon={UserMinus}
          accentClassName="text-amber-700 bg-amber-50"
        />
        <StatsCard
          title="Attendance"
          value={statistics.totalAttended}
          helper={`${funnel?.attendanceRate ?? insights?.engagementMetrics.attendanceRate ?? 0}% from confirmed`}
          icon={Activity}
          accentClassName="text-blue-700 bg-blue-50"
        />
        <StatsCard
          title="Revenue"
          value={`₹${Number(statistics.totalRevenue || 0).toLocaleString('en-IN')}`}
          helper={paymentMetrics ? `${paymentMetrics.completedPayments} paid registrations` : 'No payment data'}
          icon={IndianRupee}
          accentClassName="text-indigo-700 bg-indigo-50"
        />
        <StatsCard
          title="Scanners Active"
          value={volunteerInsights?.scannersEnabled ?? 0}
          helper={`${volunteerInsights?.totalVolunteers ?? statistics.volunteerCount} volunteers`}
          icon={ShieldCheck}
          accentClassName="text-purple-700 bg-purple-50"
        />
      </div>

      <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-ev-700" />
          <h2 className="text-base font-semibold text-ev-900 dark:text-white">Post Event Reports</h2>
        </div>

        {loadingPostReports ? (
          <div className="min-h-[88px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ev-700" />
          </div>
        ) : postReports.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No post-event reports uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {postReports.map((report) => {
              const reportName = buildEventReportName(report, event.name);
              return (
                <div
                  key={report.id}
                  className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ev-900 dark:text-white truncate">
                        {reportName}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        Version v{report.version} • {formatFileSize(report.fileSize)} • Uploaded {formatReportDate(report.uploadedAt)}
                        {report.uploadedBy ? ` • by ${report.uploadedBy.displayName || report.uploadedBy.uid}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {report.mimeType === 'application/pdf' ? (
                        <button
                          type="button"
                          onClick={() => handlePreviewReport(report)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#b3cde0]/60 px-3 py-1.5 text-xs font-semibold text-[#03396c] hover:border-[#005b96] hover:text-[#005b96]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleDownloadReport(report)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#005b96] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#03396c]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm xl:col-span-2 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ev-700" />
            <h2 className="text-base font-semibold text-ev-900 dark:text-white">Registration Trend & Funnel</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-[#b3cde0]/50 p-3 text-center dark:border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Registered</p>
              <p className="mt-1 text-lg font-bold text-ev-900 dark:text-white">{funnel?.registered ?? statistics.totalRegistrations}</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/50 p-3 text-center dark:border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Form Submitted</p>
              <p className="mt-1 text-lg font-bold text-ev-900 dark:text-white">{funnel?.formSubmitted ?? 0}</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/50 p-3 text-center dark:border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Confirmed</p>
              <p className="mt-1 text-lg font-bold text-ev-900 dark:text-white">{funnel?.confirmed ?? statistics.confirmedRegistrations}</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/50 p-3 text-center dark:border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Attended</p>
              <p className="mt-1 text-lg font-bold text-ev-900 dark:text-white">{funnel?.attended ?? statistics.totalAttended}</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/50 p-3 text-center dark:border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Drop-offs</p>
              <p className="mt-1 text-lg font-bold text-ev-900 dark:text-white">{funnel?.dropOffs ?? statistics.cancelledRegistrations}</p>
            </div>
          </div>
          <RevenueChart data={statistics.registrationsByDate || []} />
        </section>

        <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-ev-700" />
            <h2 className="text-base font-semibold text-ev-900 dark:text-white">Capacity & Timeline</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
              <p className="font-medium text-ev-900 dark:text-white">Capacity</p>
              <p className="mt-1">Max capacity: {capacity?.maxCapacity ?? 'Not set'}</p>
              <p>Utilization: {capacity?.registrationsUtilization ?? 0}%</p>
              <p>Remaining slots: {capacity?.remainingCapacity ?? 'N/A'}</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
              <p className="font-medium text-ev-900 dark:text-white">Event timeline</p>
              <p className="mt-1">Starts: {formatDays(capacity?.daysUntilStart)}</p>
              <p>Ends: {formatDays(capacity?.daysUntilEnd)}</p>
              <p>Duration: {capacity?.eventDurationDays ?? 'N/A'} day(s)</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
              <p className="font-medium text-ev-900 dark:text-white">Registration window</p>
              <p className="mt-1">Open now: {capacity?.registrationWindow?.isOpen ? 'Yes' : 'No'}</p>
              <p>Window progress: {capacity?.registrationWindow?.progressPercent ?? 0}%</p>
              <p>Days left: {capacity?.registrationWindow?.daysLeft ?? 'N/A'}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-ev-700" />
            <h2 className="text-base font-semibold text-ev-900 dark:text-white">Payment Intelligence</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatsCard title="Completed" value={paymentMetrics?.completedPayments ?? 0} icon={CheckCircle2} accentClassName="text-emerald-700 bg-emerald-50" />
            <StatsCard title="Pending" value={paymentMetrics?.pendingPayments ?? 0} icon={Clock3} accentClassName="text-amber-700 bg-amber-50" />
            <StatsCard title="Failed" value={paymentMetrics?.failedPayments ?? 0} icon={AlertCircle} accentClassName="text-red-700 bg-red-50" />
            <StatsCard title="Refunded" value={paymentMetrics?.refundedPayments ?? 0} icon={RefreshCw} accentClassName="text-gray-700 bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Revenue / Confirmed</p>
              <p className="text-sm font-semibold text-ev-900 dark:text-white">₹{Number(paymentMetrics?.avgRevenuePerConfirmed || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Coupon Usage</p>
              <p className="text-sm font-semibold text-ev-900 dark:text-white">{paymentMetrics?.couponUsageCount || 0}</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Discount Given</p>
              <p className="text-sm font-semibold text-ev-900 dark:text-white">₹{Number(paymentMetrics?.totalDiscountAmount || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
          <StatusBreakdownList
            items={paymentBreakdownItems}
            emptyMessage="Payment status data unavailable."
          />
        </section>

        <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ev-700" />
            <h2 className="text-base font-semibold text-ev-900 dark:text-white">Participant Mix</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <StatsCard title="With Team" value={demographics?.withTeamCount ?? 0} icon={Users} />
            <StatsCard title="Looking for Teammates" value={demographics?.lookingForTeammatesCount ?? 0} icon={UserCheck} accentClassName="text-blue-700 bg-blue-50" />
          </div>
          <StatusBreakdownList
            items={roleBreakdownItems}
            emptyMessage="Role distribution not available."
          />
          <div className="rounded-xl border border-[#b3cde0]/50 p-3 dark:border-gray-700">
            <p className="text-sm font-semibold text-ev-900 dark:text-white">Top registration days</p>
            <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {(statistics.topRegistrationDays || []).map((day) => (
                <p key={day.date} className="flex items-center justify-between">
                  <span>{new Date(day.date).toLocaleDateString('en-IN')}</span>
                  <span className="font-medium">{day.count}</span>
                </p>
              ))}
              {(statistics.topRegistrationDays || []).length ===
   0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No trend data yet.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-ev-700" />
          <h2 className="text-base font-semibold text-ev-900 dark:text-white">Sponsorship Data</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard title="Collected" value={`₹${Number(sponsorship?.totalSponsorshipAmountCollected || 0).toLocaleString('en-IN')}`} icon={IndianRupee} />
          <StatsCard title="Confirmed Sponsors" value={sponsorship?.confirmedSponsorships.count || 0} helper={`₹${Number(sponsorship?.confirmedSponsorships.amount || 0).toLocaleString('en-IN')}`} icon={UserCheck} accentClassName="text-emerald-700 bg-emerald-50" />
          <StatsCard title="Pending Sponsors" value={sponsorship?.pendingSponsorships.count || 0} helper={`₹${Number(sponsorship?.pendingSponsorships.amount || 0).toLocaleString('en-IN')}`} icon={UserMinus} accentClassName="text-amber-700 bg-amber-50" />
        </div>
        <SponsorTable sponsors={sponsorship?.sponsors || []} />
      </section>

      {teamInsights ? (
        <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ev-700" />
            <h2 className="text-base font-semibold text-ev-900 dark:text-white">Team Intelligence</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatsCard title="Total Teams" value={teamInsights.totalTeams} icon={Users} />
            <StatsCard title="Active Teams" value={teamInsights.activeTeams} icon={Activity} />
            <StatsCard title="Forming Teams" value={teamInsights.formingTeams} icon={Clock3} accentClassName="text-amber-700 bg-amber-50" />
            <StatsCard title="Complete Teams" value={teamInsights.completeTeams} icon={CheckCircle2} accentClassName="text-emerald-700 bg-emerald-50" />
            <StatsCard title="Join Requests" value={teamInsights.pendingJoinRequests} icon={UserCheck} />
            <StatsCard title="Invitations" value={teamInsights.pendingInvitations} icon={Users} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Confirmed Team Members</p>
              <p className="text-sm font-semibold text-ev-900 dark:text-white">{teamInsights.confirmedTeamMembers}</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Team Size</p>
              <p className="text-sm font-semibold text-ev-900 dark:text-white">{teamInsights.avgTeamSize}</p>
            </div>
            <div className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Teams Looking for Members</p>
              <p className="text-sm font-semibold text-ev-900 dark:text-white">{teamInsights.teamsLookingForMembers}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-ev-700" />
          <h2 className="text-base font-semibold text-ev-900 dark:text-white">Volunteer & Gate Operations</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard title="Total Volunteers" value={volunteerInsights?.totalVolunteers ?? statistics.volunteerCount} icon={Users} />
          <StatsCard title="QR Scanners Enabled" value={volunteerInsights?.scannersEnabled ?? 0} icon={ShieldCheck} accentClassName="text-emerald-700 bg-emerald-50" />
          <StatsCard title="Peak Gate Hour" value={volunteerInsights?.peakHour ? `${String(volunteerInsights.peakHour.hour).padStart(2, '0')}:00` : 'N/A'} helper={volunteerInsights?.peakHour ? `${volunteerInsights.peakHour.total} scans` : undefined} icon={Clock3} />
        </div>
        <FlowByHourChart data={volunteerInsights?.scansByHour || []} />
        <VolunteerLeaderboard rows={volunteerInsights?.topVolunteers || []} />
      </section>

      <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-base font-semibold text-ev-900 dark:text-white">Noting + Custom Data</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatsCard title="Noting Source" value={notingAndCustom?.source ===
   'noting' ? 'Noting' : 'Manual'} icon={BarChart3} />
          <StatsCard title="Noting Sponsors" value={notingAndCustom?.sponsorsFromNotingCount || 0} icon={Users} />
          <StatsCard title="Manual Sponsors" value={notingAndCustom?.sponsorsAddedManuallyCount || 0} icon={Users} />
          <StatsCard title="Custom Fields" value={(notingAndCustom?.customFields || []).length} icon={Activity} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#b3cde0]/60 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-ev-900 dark:text-white">Resource Summary</p>
            <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>Resources from noting: {(notingAndCustom?.resourcesFromNoting || []).length}</p>
              <p>Resources added by creator: {(notingAndCustom?.resourcesAddedByCreator || []).length}</p>
              <p>Field response coverage: {notingAndCustom?.customFieldResponseCoverage?.coverageRate || 0}%</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#b3cde0]/60 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold text-ev-900 dark:text-white">Custom Field Performance</p>
            <div className="mt-3 space-y-2">
              {(notingAndCustom?.customFields || []).map((field) => (
                <div key={field.id} className="flex items-center justify-between rounded-lg border border-[#b3cde0]/40 p-2 text-sm dark:border-gray-700">
                  <span className="font-medium text-ev-900 dark:text-white">{field.fieldLabel}</span>
                  <span className="text-gray-600 dark:text-gray-400">{field.responseCount} ({field.responseRate}%)</span>
                </div>
              ))}
              {(notingAndCustom?.customFields || []).length ===
   0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No custom fields configured for this event.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-[#b3cde0]/60 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-base font-semibold text-ev-900 dark:text-white">Recent Registrations</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={searchQuery}
            onChange={(targetEvent) => setSearchQuery(targetEvent.target.value)}
            placeholder="Search by name, UID, email, or registration ID"
            className="rounded-lg border border-[#b3cde0] px-3 py-2 text-sm focus:border-ev-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900/20"
          />
          <select
            value={statusFilter}
            onChange={(targetEvent) => setStatusFilter(targetEvent.target.value)}
            className="rounded-lg border border-[#b3cde0] px-3 py-2 text-sm focus:border-ev-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900/20"
          >
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="waitlisted">Waitlisted</option>
          </select>
        </div>
        <RecentRegistrationsTable rows={filteredRecentRegistrations} />
      </section>
    </div>
  );
}
