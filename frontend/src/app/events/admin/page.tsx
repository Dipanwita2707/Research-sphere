'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  Paperclip,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  useEventAdminActivity,
  useEventAdminEvents,
  useEventAdminOverview,
  useEventAdminUsers,
} from '@/features/event-management/hooks/useEvents';
import { eventService } from '@/features/event-management/services/event.service';
import { EVENT_TYPE_LABELS, STATUS_CONFIG } from '@/features/event-management/constants';
import type {
  EventAdminActivityItem,
  EventAdminEventSummary,
  EventPostReportSummary,
  EventAdminUserItem,
} from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { ShimmerStatCard, ShimmerCard, ShimmerTableRow, EventCardShimmer } from '@/components/shimmer';

const PAGE_SIZE = 20;

type AdminTab = 'overview' | 'events' | 'users' | 'activity';

function hasEventAnalyticsAccess(user: any) {
  const roleName = user?.role?.name || user?.userType || '';
  if (roleName ===
   'admin' || roleName ===
   'superadmin') return true;

  const permissionBuckets = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissionBuckets.some((bucket: any) => {
    const permissions = bucket?.permissions || bucket || {};
    return permissions.event_view_reports ===
   true || permissions.event_manage_all ===
   true;
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatShortDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatFileSize(size: number) {
  if (!size || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function actionLabel(action: string) {
  return action
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function eventTypeLabel(value?: string | null) {
  if (!value) return 'Event';
  return EVENT_TYPE_LABELS[value] || value.replace(/_/g, ' ');
}

function noteStatusLabel(value?: string | null) {
  if (!value) return 'No noting';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

function lifecycleClasses(stage: string) {
  if (stage ===
   'upcoming') return 'bg-sky-50 text-sky-700 border-sky-200/70';
  if (stage ===
   'ongoing') return 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
  if (stage ===
   'completed') return 'bg-violet-50 text-violet-700 border-violet-200/70';
  if (stage ===
   'cancelled') return 'bg-red-50 text-red-700 border-red-200/70';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof BarChart3;
  color: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-[#b3cde0]/40 p-5 transition-all hover:shadow-md"
      style={{ boxShadow: '0 2px 8px 0 rgba(0, 91, 150, 0.05)' }}
    >
      <div className="flex items-center gap-3.5">
        <div className={`p-2.5 rounded-xl ${color} shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-[#011f4b]">{value}</p>
          <p className="text-[11px] font-semibold text-[#6497b1] uppercase tracking-wider">{label}</p>
          <p className="text-xs text-[#6497b1] mt-1 truncate">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs gap-3">
        <span className="text-[#03396c] font-medium">{label}</span>
        <span className="font-bold text-[#011f4b]">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-[#b3cde0]/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-10 text-center">
      <div className="w-14 h-14 mx-auto mb-4 bg-[#b3cde0]/20 rounded-full flex items-center justify-center">
        <BarChart3 className="w-7 h-7 text-[#005b96]" />
      </div>
      <h3 className="text-base font-semibold text-[#011f4b]">{title}</h3>
      <p className="text-sm text-[#6497b1] mt-2">{description}</p>
    </div>
  );
}

function EventCard({
  event,
  canManage,
  onDownloadPostReport,
  onPreviewPostReport,
}: {
  event: EventAdminEventSummary;
  canManage: boolean;
  onDownloadPostReport: (eventId: string, report: EventPostReportSummary) => void;
  onPreviewPostReport: (eventId: string, report: EventPostReportSummary) => void;
}) {
  const [showApprovalStages, setShowApprovalStages] = useState(false);

  const statusConfig = STATUS_CONFIG[event.status] || {
    label: event.status,
    color: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-5 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${lifecycleClasses(event.lifecycleStage)}`}>
              {noteStatusLabel(event.lifecycleStage)}
            </span>
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e7f1f8] text-[#005b96]">
              {eventTypeLabel(event.eventType)}
            </span>
            {event.approval ? (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                Approval: {noteStatusLabel(event.approval.status)}
              </span>
            ) : null}
          </div>
          <h3 className="text-lg font-semibold text-[#011f4b]">{event.name}</h3>
          <p className="text-sm text-[#6497b1] mt-1">
            {event.eventId} • Created {formatDateTime(event.createdAt)}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-[#03396c] mt-3">
            <span>Creator: {event.createdBy?.displayName || event.createdBy?.uid || 'Unknown'}</span>
            <span>Participants: {event.participantCount}</span>
            <span>Confirmed: {event.confirmedParticipantCount}</span>
            <span>Volunteers: {event.volunteerCount}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-[#b3cde0]/60 text-[#03396c] hover:border-[#005b96] hover:text-[#005b96]"
          >
            <Eye className="w-4 h-4" />
            View
          </Link>
          <Link
            href={`/events/${event.id}/statistics`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-[#b3cde0]/60 text-[#03396c] hover:border-[#005b96] hover:text-[#005b96]"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
          {canManage ? (
            <Link
              href={`/events/${event.id}/management`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-[#005b96] text-white hover:bg-[#03396c]"
            >
              <ShieldAlert className="w-4 h-4" />
              Manage
            </Link>
          ) : null}
          {event.notingId ? (
            <Link
              href={`/noting/${event.notingId}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-[#b3cde0]/60 text-[#03396c] hover:border-[#005b96] hover:text-[#005b96]"
            >
              <FileText className="w-4 h-4" />
              Noting
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#f8fbfd] border border-[#b3cde0]/30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6497b1]">Schedule</p>
          <div className="mt-2 space-y-2 text-sm text-[#03396c]">
            <p>Start: {formatDateTime(event.startDate)}</p>
            <p>End: {formatDateTime(event.endDate)}</p>
            <p>Venue: {event.venue || '—'}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#f8fbfd] border border-[#b3cde0]/30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6497b1]">Approval Location</p>
          <div className="mt-2 space-y-2 text-sm text-[#03396c]">
            <p>Noting: {event.approval?.notingId || 'Direct event'}</p>
            <p>Current holder: {event.approval?.currentLocation?.displayName || '—'}</p>
            <p>Stage index: {event.approval?.currentFlowIndex ?? '—'}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#f8fbfd] border border-[#b3cde0]/30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6497b1]">Files & Metadata</p>
          <div className="mt-2 space-y-2 text-sm text-[#03396c]">
            <p>Attachments: {event.approval?.attachmentCount || 0}</p>
            <p>Approval actions: {event.approval?.historyCount || 0}</p>
            <p>Noting source: {event.notingEventType || 'direct'}</p>
            <p>
              Post report:{' '}
              {event.postReport
                ? `v${event.postReport.version} • ${event.postReport.originalFileName}`
                : 'Not uploaded'}
            </p>
            {event.postReport ? (
              <p>
                Uploaded by {event.postReport.uploadedBy?.displayName || event.postReport.uploadedBy?.uid || 'Unknown'} on {formatDateTime(event.postReport.uploadedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {event.postReport ? (
        <div className="rounded-2xl bg-[#f8fbfd] border border-[#b3cde0]/30 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6497b1]">Post Event Report</p>
              <p className="text-sm text-[#03396c] mt-1">
                Version {event.postReport.version} • {formatFileSize(event.postReport.fileSize)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {event.postReport.mimeType === 'application/pdf' ? (
                <button
                  type="button"
                  onClick={() => onPreviewPostReport(event.id, event.postReport as EventPostReportSummary)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#b3cde0]/60 px-3 py-1.5 text-xs font-semibold text-[#03396c] hover:border-[#005b96] hover:text-[#005b96]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onDownloadPostReport(event.id, event.postReport as EventPostReportSummary)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#005b96] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#03396c]"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {event.approval?.attachments?.length ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6497b1] mb-2">Associated Files</p>
          <div className="flex flex-wrap gap-2">
            {event.approval.attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="inline-flex items-center gap-2 rounded-full bg-[#e7f1f8] px-3 py-1 text-xs text-[#03396c]"
                title={attachment.fileDescription || attachment.fileName}
              >
                <Paperclip className="w-3.5 h-3.5" />
                {attachment.fileName}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {event.approval?.recentStages?.length ? (
        <div>
          <button
            type="button"
            onClick={() => setShowApprovalStages((value) => !value)}
            className="w-full flex items-center justify-between rounded-lg border border-[#b3cde0]/40 px-3 py-2 text-left hover:border-[#005b96]/50"
            aria-expanded={showApprovalStages}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6497b1]">
              Recent Approval Stages ({event.approval.recentStages.length})
            </span>
            <ChevronRight
              className={`w-4 h-4 text-[#6497b1] transition-transform ${showApprovalStages ? 'rotate-90' : ''}`}
            />
          </button>

          {showApprovalStages ? (
            <div className="space-y-2 mt-2">
              {event.approval.recentStages.map((stage) => (
                <div key={stage.id} className="flex flex-col gap-1 rounded-xl border border-[#b3cde0]/30 px-3 py-2 text-sm text-[#03396c]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#011f4b]">{actionLabel(stage.action)}</span>
                    <span className="text-xs text-[#6497b1]">{formatDateTime(stage.createdAt)}</span>
                  </div>
                  <p className="text-xs text-[#6497b1]">
                    By {stage.performedBy?.displayName || stage.performedBy?.uid || 'Unknown'}
                    {stage.nextHolder ? ` • Next: ${stage.nextHolder.displayName || stage.nextHolder.uid}` : ''}
                  </p>
                  {stage.remarks ? <p className="text-sm text-[#03396c]">{stage.remarks}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CreatorRow({ item }: { item: EventAdminUserItem }) {
  return (
    <tr className="border-t border-[#b3cde0]/20">
      <td className="px-4 py-3">
        <div className="font-semibold text-[#011f4b]">{item.user?.displayName || item.user?.uid || 'Unknown'}</div>
        <div className="text-xs text-[#6497b1] mt-1">
          {item.user?.uid || '—'}
          {item.user?.department ? ` • ${item.user.department}` : ''}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[#03396c]">{item.totalEvents}</td>
      <td className="px-4 py-3 text-sm text-[#03396c]">{item.totalParticipants}</td>
      <td className="px-4 py-3 text-sm text-[#03396c]">{item.totalAttachments}</td>
      <td className="px-4 py-3 text-sm text-[#03396c]">{item.pendingApprovalCount}</td>
      <td className="px-4 py-3 text-sm text-[#03396c]">{formatDateTime(item.lastCreatedAt)}</td>
    </tr>
  );
}

function ActivityCard({ item }: { item: EventAdminActivityItem }) {
  return (
    <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e7f1f8] text-[#005b96]">
              {actionLabel(item.action)}
            </span>
            {item.note ? (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                {noteStatusLabel(item.note.status)}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-[#03396c] mt-3">
            {item.performedBy?.displayName || item.performedBy?.uid || 'Unknown'} acted on {item.note?.notingId || 'an event approval'}.
          </p>
          {item.remarks ? <p className="text-sm text-[#6497b1] mt-1">{item.remarks}</p> : null}
          <p className="text-xs text-[#6497b1] mt-2">
            Current location: {item.note?.currentLocation?.displayName || '—'}
            {item.nextHolder ? ` • Forwarded to ${item.nextHolder.displayName || item.nextHolder.uid}` : ''}
          </p>
        </div>
        <div className="text-xs text-[#6497b1]">{formatDateTime(item.createdAt)}</div>
      </div>

      {item.relatedEvents.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.relatedEvents.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#f8fbfd] border border-[#b3cde0]/30 px-3 py-1.5 text-xs font-medium text-[#03396c] hover:text-[#005b96]"
            >
              <Eye className="w-3.5 h-3.5" />
              {event.name} ({event.eventId})
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function EventAdminPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [eventPage, setEventPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const debouncedSearch = useDebounce(searchInput, 350);
  const tabOptions: { key: AdminTab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { key: 'events' as const, label: 'All Events', icon: FileText },
    { key: 'users' as const, label: 'Per User', icon: Users },
    { key: 'activity' as const, label: 'Approval Activity', icon: Activity },
  ];
  const rawTab = searchParams.get('tab') as AdminTab | null;
  const tab = rawTab && tabOptions.some((item) => item.key ===
   rawTab) ? rawTab : 'overview';

  const setActiveTab = useCallback(
    (nextTab: AdminTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', nextTab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const canViewAnalytics = hasEventAnalyticsAccess(user);

  useEffect(() => {
    setEventPage(1);
  }, [debouncedSearch, statusFilter, approvalStatusFilter, creatorFilter, startDate, endDate]);

  useEffect(() => {
    setActivityPage(1);
  }, [startDate, endDate]);

  const sharedFilters = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [startDate, endDate],
  );

  const eventFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: (statusFilter || undefined) as any,
      createdById: creatorFilter || undefined,
      approvalStatus: approvalStatusFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [approvalStatusFilter, creatorFilter, debouncedSearch, endDate, startDate, statusFilter],
  );

  const { data: overview, isLoading: overviewLoading } = useEventAdminOverview(sharedFilters, {
    enabled: canViewAnalytics && tab ===
   'overview',
  });
  const { data: usersData, isLoading: usersLoading } = useEventAdminUsers(sharedFilters, {
    enabled: canViewAnalytics && (tab ===
   'users' || tab ===
   'events'),
  });
  const { data: eventsData, isLoading: eventsLoading } = useEventAdminEvents(
    eventFilters,
    eventPage,
    PAGE_SIZE,
    { enabled: canViewAnalytics && tab ===
   'events' },
  );
  const { data: activityData, isLoading: activityLoading } = useEventAdminActivity(
    { ...sharedFilters, page: activityPage, limit: PAGE_SIZE },
    { enabled: canViewAnalytics && tab ===
   'activity' },
  );

  const creatorOptions = usersData?.creators || [];

  const clearEventFilters = () => {
    setSearchInput('');
    setStatusFilter('');
    setApprovalStatusFilter('');
    setCreatorFilter('');
    setEventPage(1);
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

  const handleDownloadPostReport = async (eventId: string, report: EventPostReportSummary) => {
    try {
      const blob = await eventService.downloadPostEventReport(eventId, report.id);
      downloadBlob(blob, report.originalFileName || `event-report-v${report.version}`);
    } catch (error: any) {
      toast({ type: 'error', message: error?.response?.data?.message || 'Failed to download post-event report' });
    }
  };

  const handlePreviewPostReport = async (eventId: string, report: EventPostReportSummary) => {
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
      toast({ type: 'error', message: error?.response?.data?.message || 'Failed to preview post-event report' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#011f4b] to-[#005b96] rounded-2xl shadow-lg shadow-[#005b96]/20">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#011f4b] tracking-tight">Event Admin Dashboard</h1>
              <p className="text-sm text-[#6497b1] mt-0.5">
                Platform-wide analytics for event creation, participation, files, and approval stages.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm text-[#03396c]">
              <span className="block mb-1.5 font-medium">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-xl border border-[#b3cde0]/60 bg-white px-3 py-2 text-sm text-[#03396c] outline-none focus:border-[#005b96]"
              />
            </label>
            <label className="text-sm text-[#03396c]">
              <span className="block mb-1.5 font-medium">End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-xl border border-[#b3cde0]/60 bg-white px-3 py-2 text-sm text-[#03396c] outline-none focus:border-[#005b96]"
              />
            </label>
          </div>
        </div>

        {!canViewAnalytics ? (
          <div className="bg-white rounded-2xl border border-red-200 p-10 text-center">
            <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#011f4b]">Access denied</h2>
            <p className="text-sm text-[#6497b1] mt-2">
              You need `event_view_reports` or `event_manage_all` access to open the Event admin dashboard.
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-1 mb-8 border-b border-[#b3cde0]/30 overflow-x-auto">
              {tabOptions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                      tab ===
   item.key
                        ? 'border-[#005b96] text-[#005b96]'
                        : 'border-transparent text-[#6497b1] hover:text-[#005b96] hover:border-[#b3cde0]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {tab ===
   'overview' ? (
              <div className="space-y-6">
                {overviewLoading ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map((i) => (
                        <ShimmerStatCard key={i} />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <ShimmerCard className="h-64" />
                      <ShimmerCard className="h-64" />
                    </div>
                  </div>
                ) : overview ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      <StatCard label="Total Events" value={overview.totalEvents} helper="All event records in range" icon={FileText} color="bg-blue-500" />
                      <StatCard label="Participants" value={overview.totalParticipants} helper={`${overview.confirmedParticipants} confirmed registrations`} icon={Users} color="bg-emerald-500" />
                      <StatCard label="Pending Approval" value={overview.pendingApprovalCount} helper="Events still inside noting workflow" icon={Clock3} color="bg-amber-500" />
                      <StatCard label="Attachments" value={overview.totalAttachments} helper={`${overview.eventsWithAttachments} events with files`} icon={Paperclip} color="bg-violet-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                          <h3 className="text-sm font-bold text-[#011f4b]">By Event Status</h3>
                        </div>
                        <div className="space-y-3">
                          {Object.entries(overview.byStatus).map(([key, value]) => (
                            <ProgressRow key={key} label={noteStatusLabel(key)} value={value} total={overview.totalEvents} color="bg-[#005b96]" />
                          ))}
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                          <h3 className="text-sm font-bold text-[#011f4b]">By Lifecycle</h3>
                        </div>
                        <div className="space-y-3">
                          {Object.entries(overview.byLifecycle).map(([key, value]) => (
                            <ProgressRow
                              key={key}
                              label={noteStatusLabel(key)}
                              value={value}
                              total={overview.totalEvents}
                              color={key ===
   'ongoing' ? 'bg-emerald-500' : key ===
   'upcoming' ? 'bg-sky-500' : key ===
   'cancelled' ? 'bg-red-500' : 'bg-violet-500'}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                      <div className="flex items-center gap-2 mb-5">
                        <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                        <CalendarRange className="w-4 h-4 text-[#005b96]" />
                        <h3 className="text-sm font-bold text-[#011f4b]">Creation Timeline</h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {overview.createdTimeline.slice(-12).map((item) => (
                          <div key={item.date} className="rounded-xl border border-[#b3cde0]/30 bg-[#f8fbfd] p-3">
                            <p className="text-xs font-semibold text-[#6497b1]">{formatShortDate(item.date)}</p>
                            <p className="text-2xl font-bold text-[#011f4b] mt-1">{item.count}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                          <CheckCircle2 className="w-4 h-4 text-[#005b96]" />
                          <h3 className="text-sm font-bold text-[#011f4b]">Recent Events</h3>
                        </div>
                        <div className="space-y-3">
                          {overview.recentEvents.length ? (
                            overview.recentEvents.map((event) => (
                              <div key={event.id} className="rounded-xl border border-[#b3cde0]/30 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-[#011f4b]">{event.name}</p>
                                    <p className="text-xs text-[#6497b1] mt-1">
                                      {event.eventId} • {event.createdBy?.displayName || event.createdBy?.uid || 'Unknown'}
                                    </p>
                                  </div>
                                  <Link href={`/events/${event.id}`} className="text-sm font-semibold text-[#005b96] hover:text-[#03396c]">
                                    Open
                                  </Link>
                                </div>
                              </div>
                            ))
                          ) : (
                            <EmptyState title="No recent events" description="No event records match the selected date range." />
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                        <div className="flex items-center gap-2 mb-5">
                          <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                          <Clock3 className="w-4 h-4 text-[#005b96]" />
                          <h3 className="text-sm font-bold text-[#011f4b]">Approval Queue</h3>
                        </div>
                        <div className="space-y-3">
                          {overview.approvalQueue.length ? (
                            overview.approvalQueue.map((event) => (
                              <div key={event.id} className="rounded-xl border border-[#b3cde0]/30 px-4 py-3">
                                <p className="font-semibold text-[#011f4b]">{event.name}</p>
                                <p className="text-xs text-[#6497b1] mt-1">
                                  {event.approval?.notingId || event.eventId} • Current holder: {event.approval?.currentLocation?.displayName || '—'}
                                </p>
                              </div>
                            ))
                          ) : (
                            <EmptyState title="No approval backlog" description="No event-linked notings are pending in the selected date range." />
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {tab ===
   'events' ? (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                      <Filter className="w-4 h-4 text-[#005b96]" />
                      <span className="text-sm font-bold text-[#011f4b]">Filters</span>
                    </div>
                    <button type="button" onClick={clearEventFilters} className="text-sm font-semibold text-[#6497b1] hover:text-[#005b96]">
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                    <label className="relative">
                      <Search className="w-4 h-4 text-[#6497b1] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search by title, event ID, noting ID"
                        className="w-full rounded-xl border border-[#b3cde0]/60 bg-white pl-10 pr-3 py-2.5 text-sm text-[#03396c] outline-none focus:border-[#005b96]"
                      />
                    </label>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-xl border border-[#b3cde0]/60 bg-white px-3 py-2.5 text-sm text-[#03396c] outline-none focus:border-[#005b96]">
                      <option value="">All event statuses</option>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <select value={approvalStatusFilter} onChange={(event) => setApprovalStatusFilter(event.target.value)} className="w-full rounded-xl border border-[#b3cde0]/60 bg-white px-3 py-2.5 text-sm text-[#03396c] outline-none focus:border-[#005b96]">
                      <option value="">All approval statuses</option>
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <select value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value)} className="w-full rounded-xl border border-[#b3cde0]/60 bg-white px-3 py-2.5 text-sm text-[#03396c] outline-none focus:border-[#005b96]">
                      <option value="">All creators</option>
                      {creatorOptions.map((creator) => (
                        <option key={creator.user?.id || creator.user?.uid} value={creator.user?.id || ''}>
                          {creator.user?.displayName || creator.user?.uid || 'Unknown'}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-[#6497b1] flex items-center px-1">
                      Search by title or ID, then narrow to creator, status, or approval stage.
                    </div>
                  </div>
                </div>

                {eventsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <EventCardShimmer key={i} />
                    ))}
                  </div>
                ) : eventsData?.events?.length ? (
                  <>
                    <div className="space-y-4">
                      {eventsData.events.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          canManage={!!user?.id && event.createdBy?.id ===
   user.id}
                          onDownloadPostReport={handleDownloadPostReport}
                          onPreviewPostReport={handlePreviewPostReport}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-[#6497b1]">
                        Showing page {eventsData.pagination.page} of {eventsData.pagination.totalPages} ({eventsData.pagination.total} events)
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={eventsData.pagination.page <= 1}
                          onClick={() => setEventPage((value) => Math.max(1, value - 1))}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#b3cde0]/60 px-3 py-2 text-sm font-semibold text-[#03396c] disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={eventsData.pagination.page >= eventsData.pagination.totalPages}
                          onClick={() => setEventPage((value) => value + 1)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#b3cde0]/60 px-3 py-2 text-sm font-semibold text-[#03396c] disabled:opacity-50"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState title="No events found" description="Adjust the filters to broaden the search." />
                )}
              </div>
            ) : null}

            {tab ===
   'users' ? (
              <div className="space-y-6">
                {usersLoading ? (
                  <ShimmerCard className="overflow-hidden">
                    <div className="px-6 py-5 border-b border-[#b3cde0]/20">
                      <div className="shimmer-animate h-4 w-32 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
                    </div>
                    <div className="p-4 space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <ShimmerTableRow key={i} columns={6} />
                      ))}
                    </div>
                  </ShimmerCard>
                ) : usersData?.creators?.length ? (
                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden">
                    <div className="px-6 py-5 border-b border-[#b3cde0]/20">
                      <h3 className="text-sm font-bold text-[#011f4b]">Events Created Per User</h3>
                      <p className="text-sm text-[#6497b1] mt-1">{usersData.totalCreators} creators matched the selected date range.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-[#f8fbfd]">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6497b1]">User</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6497b1]">Events</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6497b1]">Participants</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6497b1]">Attachments</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6497b1]">Pending</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6497b1]">Latest</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersData.creators.map((item) => (
                            <CreatorRow key={item.user?.id || `${item.user?.uid}-${item.lastCreatedAt}`} item={item} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No creator analytics" description="Try a broader date range." />
                )}
              </div>
            ) : null}

            {tab ===
   'activity' ? (
              <div className="space-y-6">
                {activityLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <ShimmerCard key={i} className="p-4">
                        <ShimmerTableRow columns={4} />
                      </ShimmerCard>
                    ))}
                  </div>
                ) : activityData?.items?.length ? (
                  <>
                    <div className="space-y-4">
                      {activityData.items.map((item) => (
                        <ActivityCard key={item.id} item={item} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-[#6497b1]">
                        Showing page {activityData.pagination.page} of {activityData.pagination.totalPages} ({activityData.pagination.total} actions)
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={activityData.pagination.page <= 1}
                          onClick={() => setActivityPage((value) => Math.max(1, value - 1))}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#b3cde0]/60 px-3 py-2 text-sm font-semibold text-[#03396c] disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={activityData.pagination.page >= activityData.pagination.totalPages}
                          onClick={() => setActivityPage((value) => value + 1)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#b3cde0]/60 px-3 py-2 text-sm font-semibold text-[#03396c] disabled:opacity-50"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState title="No approval activity" description="No event-linked approval actions match the selected date range." />
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
