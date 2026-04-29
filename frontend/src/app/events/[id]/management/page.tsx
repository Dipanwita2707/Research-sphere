'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, AlertCircle, BarChart3, Activity,
  RefreshCw, Shield, Settings, QrCode, Store,
  MessageSquare, Tag, Users, X, Download, FileUp, Eye,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, EventStatistics, EventVolunteer, EventPostReportSummary } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { EventManagementShimmer } from '@/components/shimmer';

// ── Constants (used for computed pieData) ──────────────────────
const STATUS_COLORS = {
  confirmed: { chart: '#10b981' },
  pending: { chart: '#f59e0b' },
  cancelled: { chart: '#ef4444' },
  waitlisted: { chart: '#6b7280' },
};

type TabType = 'overview' | 'registrations' | 'volunteers' | 'analytics' | 'stalls' | 'feedback' | 'coupons' | 'settings';
const VALID_TABS: TabType[] = ['overview', 'registrations', 'volunteers', 'analytics', 'stalls', 'feedback', 'coupons', 'settings'];

const TabLoader = () => (
  <div className="rounded-2xl border border-[#b3cde0] bg-white p-10 text-center shadow-ev dark:border-gray-700 dark:bg-gray-800">
    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-ev-700" />
    <p className="text-sm text-ev-400 dark:text-gray-400">Loading tab...</p>
  </div>
);

const OverviewTab = dynamic(() => import('./tabs/OverviewTab'), { loading: () => <TabLoader /> });
const RegistrationsTab = dynamic(() => import('./tabs/RegistrationsTab'), { loading: () => <TabLoader /> });
const VolunteersTab = dynamic(() => import('./tabs/VolunteersTab'), { loading: () => <TabLoader /> });
const AnalyticsTab = dynamic(() => import('./tabs/AnalyticsTab'), { loading: () => <TabLoader /> });
const FeedbackTab = dynamic(() => import('./tabs/FeedbackTab'), { loading: () => <TabLoader /> });
const StallsTab = dynamic(() => import('./tabs/StallsTab'), { loading: () => <TabLoader /> });
const EventSettings = dynamic(() => import('@/features/event-management/components/EventSettings'), { loading: () => <TabLoader /> });
const CouponManagement = dynamic(() => import('@/features/event-management/components/CouponManagement'), { loading: () => <TabLoader /> });

export default function EventManagementPage() {
  const params = useParams() as Record<string, string>;
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const { toast } = useToast();
  const eventId = params.id as string;

  // Tab from URL (persists on refresh & back navigation)
  const tabFromUrl = searchParams.get('tab') as TabType | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview';

  // ── State ──────────────────────────────────────────────────────
  const [event, setEvent] = useState<Event | null>(null);
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [volunteers, setVolunteers] = useState<EventVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Sync activeTab when URL tab changes (e.g. back from volunteer detail)
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Feedback QR (shown in global header)
  const [showFeedbackQR, setShowFeedbackQR] = useState(false);
  const [feedbackQRUrl, setFeedbackQRUrl] = useState<string | null>(null);
  const [showPostReportModal, setShowPostReportModal] = useState(false);
  const [postReportFile, setPostReportFile] = useState<File | null>(null);
  const [postReports, setPostReports] = useState<EventPostReportSummary[]>([]);
  const [latestPostReport, setLatestPostReport] = useState<EventPostReportSummary | null>(null);
  const [loadingPostReports, setLoadingPostReports] = useState(false);
  const [uploadingPostReport, setUploadingPostReport] = useState(false);

  const formatReportSize = (size: number) => {
    if (!size || size <= 0) return '0 B';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatReportDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

// ── Data Loading ───────────────────────────────────────────────
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);



  const loadData = async () => {
    try {
      setLoading(true);
      const eventData = await eventService.getEventById(eventId);

      // ── Security: block users who cannot manage this event ──
      if (!(eventData as any).canManage) {
        toast({ type: 'error', message: 'You do not have permission to manage this event' });
        router.replace('/events');
        return;
      }

      setEvent(eventData);

      // Load stats and volunteers in parallel - stats may fail for draft events
      const [statsData, volunteersData] = await Promise.allSettled([
        eventService.getStatistics(eventId),
        eventService.getVolunteers(eventId)
      ]);

      if (statsData.status ===
   'fulfilled') {
        setStatistics(statsData.value);
      } else {
        // Provide empty statistics for draft events
        setStatistics({
          totalRegistrations: 0,
          confirmedRegistrations: 0,
          pendingRegistrations: 0,
          cancelledRegistrations: 0,
          waitlistedRegistrations: 0,
          totalAttended: 0,
          totalEntries: 0,
          totalExits: 0,
          currentlyInside: 0,
          totalRevenue: 0,
          volunteerCount: 0,
          recentRegistrations: [],
          registrationsByDate: [],
        } as unknown as EventStatistics);
      }

      if (volunteersData.status ===
   'fulfilled') {
        setVolunteers(volunteersData.value);
      }
    } catch (error: any) {
      toast({
        type: 'error',
        message: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [statsData, volunteersData] = await Promise.all([
        eventService.getStatistics(eventId),
        eventService.getVolunteers(eventId)
      ]);
      setStatistics(statsData);
      setVolunteers(volunteersData);
      toast({ type: 'success', message: 'Data refreshed' });
    } catch (error: any) {
      toast({ type: 'error', message: 'Failed to refresh data' });
    } finally {
      setRefreshing(false);
    }
  };

  // ── Computed Metrics ───────────────────────────────────────────
  const attendanceRate = useMemo(() => {
    if (!statistics || statistics.confirmedRegistrations ===
   0) return 0;
    const attended = statistics.totalAttended ?? 0;
    return Math.round((attended / statistics.confirmedRegistrations) * 100);
  }, [statistics]);

  const confirmationRate = useMemo(() => {
    if (!statistics || statistics.totalRegistrations ===
   0) return 0;
    return Math.round((statistics.confirmedRegistrations / statistics.totalRegistrations) * 100);
  }, [statistics]);

  const capacityUsage = useMemo(() => {
    if (!event?.maxCapacity || !statistics) return null;
    return Math.round((statistics.totalRegistrations / event.maxCapacity) * 100);
  }, [event, statistics]);

  const registrationData = useMemo(() => {
    if (!statistics) return [];
    return [
      { name: 'Confirmed', value: statistics.confirmedRegistrations, color: STATUS_COLORS.confirmed.chart },
      { name: 'Pending', value: statistics.pendingRegistrations, color: STATUS_COLORS.pending.chart },
      { name: 'Cancelled', value: statistics.cancelledRegistrations, color: STATUS_COLORS.cancelled.chart },
      { name: 'Waitlisted', value: statistics.waitlistedRegistrations, color: STATUS_COLORS.waitlisted.chart },
    ].filter((d) => d.value > 0);
  }, [statistics]);

  const pieData = useMemo(() => registrationData, [registrationData]);

  const trendData = useMemo(() => {
    if (!statistics?.registrationsByDate) return [];
    let cumulative = 0;
    return statistics.registrationsByDate.map((d) => {
      cumulative += d.count;
      return {
        date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        daily: d.count,
        cumulative,
      };
    });
  }, [statistics]);


  // ── Loading & Error States ─────────────────────────────────────
  if (loading) {
    return <EventManagementShimmer />;
  }

  if (!event || !statistics) {
    return (
      <div className="ev-page flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-ev-900 dark:text-white mb-2">Data Not Available</h2>
          <p className="text-ev-400 dark:text-gray-400 mb-6">Unable to load event management data</p>
          <Link
            href="/events/my-events"
            className="ev-btn inline-flex items-center gap-2 px-6 py-3 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Events
          </Link>
        </div>
      </div>
    );
  }

  // ── Event Status Badge ─────────────────────────────────────────
  const statusBadge = () => {
    const map: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      published: 'bg-ev-50 text-ev-800 dark:bg-ev-900/30 dark:text-ev-200',
      ongoing: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${map[event.status] || map.draft}`}>
        {event.status}
      </span>
    );
  };


  // ── Tab Navigation ─────────────────────────────────────────────
  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'registrations', label: 'Registrations', icon: Users },
    { id: 'volunteers', label: 'Volunteer Management', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'feedback', label: 'Feedback Section', icon: MessageSquare },
  ];

  if (event?.hasStalls) {
    tabs.push({ id: 'stalls', label: 'Stall Management', icon: Store });
  }
  if (event?.paymentType ===
   'paid') {
    tabs.push({ id: 'coupons', label: 'Coupons', icon: Tag });
  }
  tabs.push({ id: 'settings', label: 'Event Settings', icon: Settings });

  const handleShowFeedbackQR = async () => {
    if (typeof window ===
   'undefined') return;
    const url = `${window.location.origin}/events/${eventId}/feedback`;
    try {
      const QRCodeGenerator = (await import('qrcode')).default;
      const dataUrl = await QRCodeGenerator.toDataURL(url, { width: 256, margin: 2 });
      setFeedbackQRUrl(dataUrl);
      setShowFeedbackQR(true);
    } catch {
      toast({ type: 'error', message: 'Failed to generate QR code' });
    }
  };

  const loadPostReports = async () => {
    try {
      setLoadingPostReports(true);
      const data = await eventService.getPostEventReports(eventId);
      setPostReports(data.versions || []);
      setLatestPostReport(data.latestReport || null);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) || 'Failed to load post event reports' });
    } finally {
      setLoadingPostReports(false);
    }
  };

  const handleOpenPostReportModal = async () => {
    setShowPostReportModal(true);
    setPostReportFile(null);
    await loadPostReports();
  };

  const handleUploadPostReport = async () => {
    if (!postReportFile) {
      toast({ type: 'error', message: 'Please choose a report file first' });
      return;
    }

    const extension = postReportFile.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'doc', 'docx'].includes(extension)) {
      toast({ type: 'error', message: 'Only PDF, DOC, and DOCX files are allowed' });
      return;
    }

    if (postReportFile.size > 20 * 1024 * 1024) {
      toast({ type: 'error', message: 'Maximum allowed size is 20 MB' });
      return;
    }

    try {
      setUploadingPostReport(true);
      const uploaded = await eventService.uploadPostEventReport(eventId, postReportFile);
      toast({
        type: 'success',
        message: `Post-event report uploaded as version ${uploaded.version}`,
      });
      setPostReportFile(null);
      await loadPostReports();
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) || 'Failed to upload post-event report' });
    } finally {
      setUploadingPostReport(false);
    }
  };

  const handleDownloadPostReport = async (report: EventPostReportSummary) => {
    try {
      const blob = await eventService.downloadPostEventReport(eventId, report.id);
      triggerBlobDownload(blob, report.originalFileName || `event-report-v${report.version}`);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) || 'Failed to download report' });
    }
  };

  const handlePreviewPostReport = async (report: EventPostReportSummary) => {
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

  return (
    <div className="ev-page">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border-b border-[#b3cde0] dark:border-gray-700 sticky top-0 z-10 shadow-ev">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                  href="/events/my-events"
                className="p-2 rounded-lg hover:bg-ev-50 dark:hover:bg-gray-700 transition-colors text-ev-700 dark:text-ev-400"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-ev-900 dark:text-white">
                    Event Management
                  </h1>
                  {statusBadge()}
                </div>
                <p className="text-sm text-ev-400 dark:text-gray-400 mt-0.5 max-w-md truncate">
                  {event.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleShowFeedbackQR}
                className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm font-medium text-ev-800 dark:text-gray-300 bg-ev-50 dark:bg-gray-700 rounded-lg hover:bg-ev-200/50 dark:hover:bg-gray-600 transition-colors"
                title="Feedback QR Code"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Feedback QR</span>
              </button>
              <button
                onClick={handleOpenPostReportModal}
                className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm font-medium text-ev-800 dark:text-gray-300 bg-ev-50 dark:bg-gray-700 rounded-lg hover:bg-ev-200/50 dark:hover:bg-gray-600 transition-colors"
                title="Post Event Report Upload"
              >
                <FileUp className="w-4 h-4" />
                <span className="hidden sm:inline">Post Report</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm font-medium text-ev-800 dark:text-gray-300 bg-ev-50 dark:bg-gray-700 rounded-lg hover:bg-ev-200/50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  router.replace(`/events/${eventId}/management?tab=${tab.id}`, { scroll: false });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-lg transition-all whitespace-nowrap ${activeTab ===
   tab.id
                  ? 'bg-ev-700 text-white shadow-ev'
                  : 'text-ev-400 dark:text-gray-400 hover:bg-ev-50 dark:hover:bg-gray-700'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Draft Mode Banner */}
        {event.status ===
   'draft' && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Draft Event</h4>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                You can assign volunteers now. Registrations & analytics will be available after publishing.
              </p>
            </div>
          </div>
        )}

        {activeTab ===
   'overview' && (
          <OverviewTab
            event={event}
            statistics={statistics}
            volunteers={volunteers}
            capacityUsage={capacityUsage}
            confirmationRate={confirmationRate}
            attendanceRate={attendanceRate}
            trendData={trendData}
            pieData={pieData}
          />
        )}
        {activeTab ===
   'registrations' && (
          <RegistrationsTab eventId={eventId} event={event} />
        )}
        {activeTab ===
   'volunteers' && (
          <VolunteersTab
            eventId={eventId}
            event={event}
            volunteers={volunteers}
            onVolunteersChange={setVolunteers}
          />
        )}
        {activeTab ===
   'analytics' && (
          <AnalyticsTab
            eventId={eventId}
            statistics={statistics}
            trendData={trendData}
            confirmationRate={confirmationRate}
            attendanceRate={attendanceRate}
            volunteers={volunteers}
          />
        )}
        {activeTab ===
   'feedback' && <FeedbackTab eventId={eventId} />}
        {activeTab ===
   'stalls' && (
          <StallsTab
            eventId={eventId}
            event={event}
            onEventChange={(updated) => setEvent(updated)}
          />
        )}
        {activeTab ===
   'settings' && (
          <EventSettings eventId={event.id} onToast={toast} isFromNoting={!!event.notingId} />
        )}
        {activeTab ===
   'coupons' && (
          <CouponManagement
            eventId={eventId}
            isPaidEvent={event.paymentType ===
   'paid'}
            onToast={toast}
          />
        )}
      </div>

      {/* Post Event Report Modal */}
      {showPostReportModal && (
        <div className="ev-overlay" onClick={() => !uploadingPostReport && setShowPostReportModal(false)}>
          <div className="ev-modal p-6 max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-ev-900 dark:text-white">Post Event Report Upload</h3>
                <p className="text-xs text-ev-400 dark:text-gray-400 mt-1">
                  Upload PDF/DOC/DOCX up to 20 MB. Re-uploads create a new version automatically.
                </p>
              </div>
              <button
                onClick={() => !uploadingPostReport && setShowPostReportModal(false)}
                className="p-1 rounded-full hover:bg-ev-50 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 text-ev-400" />
              </button>
            </div>

            <div className="rounded-xl border border-[#b3cde0] p-4 bg-[#f8fbfd] dark:bg-gray-900/30 dark:border-gray-700">
              <label className="block text-sm font-medium text-ev-900 dark:text-white mb-2">Choose file</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setPostReportFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-ev-700 dark:text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ev-50 file:px-3 file:py-2 file:font-medium file:text-ev-800 hover:file:bg-ev-200/40"
                disabled={uploadingPostReport}
              />
              {postReportFile ? (
                <p className="mt-2 text-xs text-ev-500 dark:text-gray-400">
                  Selected: {postReportFile.name} ({formatReportSize(postReportFile.size)})
                </p>
              ) : null}

              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleUploadPostReport}
                  disabled={!postReportFile || uploadingPostReport}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#005b96] text-white rounded-lg hover:bg-[#03396c] disabled:opacity-50"
                >
                  {uploadingPostReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                  Upload Report
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-ev-900 dark:text-white">Version History</h4>
                {latestPostReport ? (
                  <span className="text-xs text-ev-500 dark:text-gray-400">
                    Latest: v{latestPostReport.version} • {formatReportDate(latestPostReport.uploadedAt)}
                  </span>
                ) : null}
              </div>

              {loadingPostReports ? (
                <div className="py-8 text-center text-sm text-ev-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                  Loading report history...
                </div>
              ) : postReports.length === 0 ? (
                <div className="py-8 text-center text-sm text-ev-500 dark:text-gray-400 border border-dashed border-[#b3cde0] rounded-xl">
                  No post-event report uploaded yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {postReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[#b3cde0]/70 p-3 bg-white dark:bg-gray-800 dark:border-gray-700"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ev-900 dark:text-white truncate">
                          v{report.version} • {report.originalFileName}
                        </p>
                        <p className="text-xs text-ev-500 dark:text-gray-400 mt-1">
                          {formatReportSize(report.fileSize)} • Uploaded by {report.uploadedBy?.displayName || report.uploadedBy?.uid || 'Unknown'} • {formatReportDate(report.uploadedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {report.mimeType === 'application/pdf' ? (
                          <button
                            onClick={() => handlePreviewPostReport(report)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#b3cde0] text-[#03396c] hover:bg-ev-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                          </button>
                        ) : null}
                        <button
                          onClick={() => handleDownloadPostReport(report)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#005b96] text-white hover:bg-[#03396c]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback QR Modal */}
      {showFeedbackQR && feedbackQRUrl && (
        <div className="ev-overlay" onClick={() => setShowFeedbackQR(false)}>
          <div className="ev-modal p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-ev-900 dark:text-white">Feedback QR Code</h3>
              <button onClick={() => setShowFeedbackQR(false)} className="p-1 rounded-full hover:bg-ev-50 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-ev-400" />
              </button>
            </div>
            <p className="text-sm text-ev-400 dark:text-gray-400 mb-4">Scan to give event feedback (10 points + short description)</p>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img src={feedbackQRUrl} alt="Feedback QR" className="w-64 h-64" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
