'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Hash,
  Layers3,
  Lightbulb,
  RefreshCw,
  TrendingUp,
  Wallet,
  X,
  Calendar,
  Filter,
} from 'lucide-react';
import { AnalyticsPanel, TrendChartPanel, RadarComparisonChart } from '@/components/analytics';
import { VIZ, categoryColor, ui } from '@/components/analytics/theme';
import type { RadarAxis, RadarDataSet } from '@/components/analytics';
import type { 
  DrdAnalyticsResponse, 
  PersonSubmissionsResponse, 
  ApplicantPersonTrackerWorks,
  PersonSubmission,
  ProgressTrackerRecord
} from '@/features/ipr-management/services/drdAnalytics.service';
import { drdAnalyticsService } from '@/features/ipr-management/services/drdAnalytics.service';
import type { ProfileData } from '@/shared/types/research-profile.types';
import { logger } from '@/shared/utils/logger';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildQuickRanges() {
  const today = isoDate(new Date());
  return [
    { label: '30 days', from: isoDate(new Date(Date.now() - 30 * 86400e3)), to: today },
    { label: '3 months', from: isoDate(new Date(Date.now() - 90 * 86400e3)), to: today },
    { label: 'Last year', from: isoDate(new Date(Date.now() - 365 * 86400e3)), to: today },
    { label: 'This year', from: isoDate(new Date(new Date().getFullYear(), 0, 1)), to: today },
  ];
}

interface ApplicantPerson {
  personId: string;
  applicantName: string;
  schoolId: string | null;
  schoolName: string;
  departmentId: string | null;
  departmentName: string;
  filingCounts: {
    research: number;
    book: number;
    conference: number;
    ipr: number;
    grants: number;
  };
  approvedCount: number;
  totalIncentive: number;
  totalApplications: number;
}

type CategoryKey = 'research' | 'book' | 'conference' | 'ipr' | 'grants';

const CATEGORY_META: Record<CategoryKey, { label: string; icon: React.ReactNode }> = {
  research: { label: 'Research papers', icon: <FileText className="h-4 w-4" /> },
  book: { label: 'Book / chapter', icon: <BookOpen className="h-4 w-4" /> },
  conference: { label: 'Conference papers', icon: <Layers3 className="h-4 w-4" /> },
  ipr: { label: 'IPR / patents', icon: <Lightbulb className="h-4 w-4" /> },
  grants: { label: 'Grants', icon: <Wallet className="h-4 w-4" /> },
};

const TONE = {
  good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  bad: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  wait: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  neutral: 'bg-stone-100 text-stone-600 dark:bg-gray-700 dark:text-gray-300',
} as const;

const STATUS_META: Record<string, { label: string; color: string }> = {
  approved:           { label: 'Approved', color: TONE.good },
  completed:          { label: 'Completed', color: TONE.good },
  drd_head_approved:  { label: 'DRD approved', color: TONE.good },
  published:          { label: 'Published', color: TONE.good },
  submitted_to_govt:  { label: 'Submitted to govt', color: TONE.wait },
  under_review:       { label: 'Under review', color: TONE.wait },
  changes_required:   { label: 'Changes required', color: TONE.wait },
  resubmitted:        { label: 'Resubmitted', color: TONE.wait },
  rejected:           { label: 'Rejected', color: TONE.bad },
  drd_rejected:       { label: 'Rejected', color: TONE.bad },
  submitted:          { label: 'Submitted', color: TONE.neutral },
  recommended:        { label: 'Recommended', color: TONE.wait },
};

function fmtDate(v: string | null | undefined) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  return '₹' + v.toLocaleString('en-IN');
}

function publicationTypeLabel(type: string) {
  const labels: Record<string, string> = {
    research_paper: 'Research Paper',
    book: 'Book',
    book_chapter: 'Book Chapter',
    conference_paper: 'Conference Paper',
    grant_proposal: 'Grant Proposal',
  };
  return labels[type] || type.replace(/_/g, ' ');
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status.replace(/_/g, ' '), color: TONE.neutral };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function PubTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    research_paper: 'Research Paper',
    book: 'Book',
    book_chapter: 'Book Chapter',
    conference_paper: 'Conference Paper',
    ipr_patent: 'Patent',
    ipr_copyright: 'Copyright',
    ipr_trademark: 'Trademark',
    ipr_design: 'Design',
    grant: 'Grant',
  };
  return <span className="text-xs text-stone-500 dark:text-gray-400">{labels[type] || type.replace(/_/g, ' ')}</span>;
}

function TrackerWorkStatusBadge({ status }: { status: ProgressTrackerRecord['currentStatus'] }) {
  const palette: Record<string, string> = {
    writing: TONE.neutral,
    communicated: TONE.wait,
    submitted: TONE.wait,
    accepted: TONE.good,
    published: TONE.good,
    rejected: TONE.bad,
  };
  const label = status.replace(/_/g, ' ');
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${palette[status] || TONE.neutral}`}>{label}</span>;
}

function TrackerWorkCard({ work }: { work: ProgressTrackerRecord }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-md border border-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600 dark:border-gray-600 dark:text-gray-300">
          {publicationTypeLabel(work.publicationType)}
        </span>
        <TrackerWorkStatusBadge status={work.currentStatus} />
      </div>
      <h4 className="mt-2.5 text-sm font-semibold leading-snug text-stone-900 dark:text-white">{work.title}</h4>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-gray-400">
        <span className="tabular-nums">{work.trackingNumber}</span>
        {work.researchContribution?.applicationNumber && <span>Linked: {work.researchContribution.applicationNumber}</span>}
        <span>{work.schoolName}</span>
      </div>
      <dl className="mt-3 grid gap-2 border-t border-stone-100 pt-3 text-xs dark:border-gray-700 sm:grid-cols-3">
        <div>
          <dt className="text-stone-500 dark:text-gray-400">Started</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-stone-800 dark:text-gray-100">{fmtDate(work.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-stone-500 dark:text-gray-400">Expected / actual</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-stone-800 dark:text-gray-100">{fmtDate(work.actualCompletionDate || work.expectedCompletionDate)}</dd>
        </div>
        <div>
          <dt className="text-stone-500 dark:text-gray-400">Last movement</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-stone-800 dark:text-gray-100">{fmtDate(work.latestStatusChangedAt || work.updatedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Submissions Drawer Component
   ────────────────────────────────────────────────────────────────── */
interface SubmissionsDrawerProps {
  personId: string;
  personName: string;
  category: CategoryKey;
  fromDate: string;
  toDate: string;
  data: PersonSubmissionsResponse | null;
  loading: boolean;
  onClose: () => void;
}

function SubmissionsDrawer({ personId, personName, category, fromDate, toDate, data, loading, onClose }: SubmissionsDrawerProps) {
  const [filter, setFilter] = useState<'all' | 'approved' | 'other'>('all');
  const meta = CATEGORY_META[category];

  const submissions = data?.submissions ?? [];
  const visible =
    filter === 'approved' ? submissions.filter((s) => s.isApproved) :
    filter === 'other'    ? submissions.filter((s) => !s.isApproved) :
    submissions;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-stone-900/40 dark:bg-black/60"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-stone-200 bg-[#faf8f6] shadow-xl dark:border-gray-700 dark:bg-gray-900">
        {/* Drawer header */}
        <div className="flex items-center gap-3 border-b border-stone-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-gray-700 dark:text-gray-300">
            {meta.icon}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-sm ring-2 ring-white dark:ring-gray-800" style={{ backgroundColor: categoryColor(category) }} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-stone-900 dark:text-white">{meta.label}</h2>
            <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-gray-400">{personName}</p>
          </div>
          {data && (
            <div className="hidden shrink-0 items-center gap-1 text-xs text-stone-500 dark:text-gray-400 sm:flex">
              <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{data.approvedCount}</span> approved /
              <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{data.totalCount}</span> total
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="border-b border-stone-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/50" role="group" aria-label="Filter submissions">
            {(['all', 'approved', 'other'] as const).map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber'
                    : 'text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'approved' ? 'Approved' : 'Pending / others'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading submissions">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-lg bg-stone-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-stone-400 dark:text-gray-500">
              <FileText className="h-8 w-8" />
              <p className="text-sm">No submissions found for this filter.</p>
            </div>
          ) : (
            visible.map((sub) => <SubmissionCard key={sub.id} sub={sub} />)
          )}
        </div>
      </div>
    </>
  );
}

function MetaItem({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`text-xs text-stone-500 dark:text-gray-400 ${wide ? 'col-span-2' : ''}`}>
      {label}: <span className="font-medium text-stone-700 dark:text-gray-200">{children}</span>
    </div>
  );
}

function SubmissionCard({ sub }: { sub: PersonSubmission }) {
  const link = sub.doi
    ? (sub.doi.startsWith('http') ? sub.doi : `https://doi.org/${sub.doi}`)
    : sub.weblink || null;
  const hasIncentive = sub.incentiveAmount != null && sub.incentiveAmount > 0;
  const hasPoints = sub.pointsAwarded != null && sub.pointsAwarded > 0;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Title row */}
      <div className="flex items-start gap-2">
        {sub.isApproved ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Approved" />
        ) : (
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-stone-400 dark:text-gray-500" aria-label="Not yet approved" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-stone-900 dark:text-white">{sub.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <PubTypeLabel type={sub.publicationType} />
            <StatusBadge status={sub.status} />
            {sub.applicationNumber && (
              <span className="flex items-center gap-0.5 text-xs tabular-nums text-stone-500 dark:text-gray-400">
                <Hash className="h-3 w-3" />{sub.applicationNumber}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 pl-6">
        {sub.venue && (
          <div className="col-span-2 flex items-center gap-1 text-xs text-stone-600 dark:text-gray-300">
            <FileText className="h-3 w-3 text-stone-400 dark:text-gray-500" />
            <span className="truncate font-medium">{sub.venue}</span>
          </div>
        )}
        {sub.submittedAt && <MetaItem label="Submitted">{fmtDate(sub.submittedAt)}</MetaItem>}
        {sub.publicationDate && <MetaItem label="Published">{fmtDate(sub.publicationDate)}</MetaItem>}
        {sub.indexedIn && <MetaItem label="Indexed">{sub.indexedIn}</MetaItem>}
        {sub.quartile && <MetaItem label="Quartile">{sub.quartile}</MetaItem>}
        {sub.impactFactor != null && <MetaItem label="IF">{sub.impactFactor}</MetaItem>}
        {sub.naasRating != null && <MetaItem label="NAAS">{sub.naasRating}</MetaItem>}
        {sub.extra?.iprType && <MetaItem label="Type"><span className="capitalize">{sub.extra.iprType}</span></MetaItem>}
        {sub.extra?.filingType && <MetaItem label="Filing"><span className="capitalize">{sub.extra.filingType}</span></MetaItem>}
        {sub.extra?.govtApplicationId && <MetaItem label="Govt ID" wide>{sub.extra.govtApplicationId}</MetaItem>}
        {sub.extra?.fundingAgencyName && <MetaItem label="Agency" wide>{sub.extra.fundingAgencyName}</MetaItem>}
        {sub.extra?.submittedAmount != null && <MetaItem label="Proposed">{fmtCurrency(sub.extra.submittedAmount)}</MetaItem>}
        {sub.nationalInternational && <MetaItem label="Scope"><span className="capitalize">{sub.nationalInternational}</span></MetaItem>}
      </div>

      {/* Incentive + link row */}
      {(hasIncentive || hasPoints || link) && (
        <div className="mt-3 flex items-center justify-between gap-3 pl-6">
          <div className="flex flex-wrap items-center gap-2">
            {hasIncentive && (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {fmtCurrency(sub.incentiveAmount)} incentive
              </span>
            )}
            {hasPoints && (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-700 dark:bg-gray-700 dark:text-gray-200">
                {sub.pointsAwarded} pts
              </span>
            )}
          </div>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-wine hover:underline dark:text-amber"
            >
              <ExternalLink className="h-3 w-3" /> View paper
            </a>
          )}
        </div>
      )}
    </div>
  );
}

interface ComprehensiveAnalyticsTabProps {
  drdAnalyticsData: DrdAnalyticsResponse | null;
  submissionsData: PersonSubmissionsResponse | null;
  trackerWorks: ApplicantPersonTrackerWorks | null;
  profileData: ProfileData;
  userId: string;
}

export default function ComprehensiveAnalyticsTab({
  drdAnalyticsData: initialDrdAnalyticsData,
  submissionsData: initialSubmissionsData,
  trackerWorks: initialTrackerWorks,
  profileData,
  userId
}: ComprehensiveAnalyticsTabProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Date filtering state
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3))); // 1 year ago
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [quickRanges] = useState(buildQuickRanges);
  
  // Data state
  const [drdAnalyticsData, setDrdAnalyticsData] = useState<DrdAnalyticsResponse | null>(initialDrdAnalyticsData);
  const [submissionsData, setSubmissionsData] = useState<PersonSubmissionsResponse | null>(initialSubmissionsData);
  const [trackerWorks, setTrackerWorks] = useState<ApplicantPersonTrackerWorks | null>(initialTrackerWorks);

  // Drawer state for submissions
  const [drawerCategory, setDrawerCategory] = useState<CategoryKey | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerData, setDrawerData] = useState<PersonSubmissionsResponse | null>(null);

  // Fetch submissions for drawer
  const fetchDrawerSubmissions = async (category: CategoryKey) => {
    if (!userId) return;
    
    try {
      setDrawerLoading(true);
      const response = await drdAnalyticsService.getApplicantPersonSubmissions(userId, {
        from: fromDate,
        to: toDate,
        category,
      }, { optional: true });
      
      if (response.data) {
        setDrawerData(response.data);
      }
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) setDrawerData(null);
      else logger.error('Failed to load drawer submissions', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Handle category card click
  const handleCategoryClick = (category: CategoryKey, count: number) => {
    if (count > 0) {
      setDrawerCategory(category);
      fetchDrawerSubmissions(category);
    }
  };

  // Close drawer
  const handleCloseDrawer = () => {
    setDrawerCategory(null);
    setDrawerData(null);
  };

  // Fetch data with date filters
  const fetchAnalyticsData = async (from?: string, to?: string) => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const filters = {
        from: from || fromDate,
        to: to || toDate,
      };

      const [analyticsResponse, submissionsResponse] = await Promise.all([
        drdAnalyticsService.getApplicantPersonAnalytics(userId, filters, { optional: true }),
        drdAnalyticsService.getApplicantPersonSubmissions(userId, filters, { optional: true }).catch(() => null),
      ]);

      if (analyticsResponse.data) {
        setDrdAnalyticsData(analyticsResponse.data);
        
        // Extract tracker works from extensions
        const trackerWorksData = analyticsResponse.data.extensions?.trackerWorks as ApplicantPersonTrackerWorks | undefined;
        setTrackerWorks(trackerWorksData || null);
      }

      if (submissionsResponse?.data) {
        setSubmissionsData(submissionsResponse.data);
      }
    } catch (err) {
      // 404 = no submissions in this period; that is an empty report, not a failure.
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        setDrdAnalyticsData(null);
        setSubmissionsData(null);
        setTrackerWorks(null);
      } else {
        logger.error('Failed to load analytics data', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle date filter changes
  const handleDateFilterChange = (newFromDate: string, newToDate: string) => {
    setFromDate(newFromDate);
    setToDate(newToDate);
    fetchAnalyticsData(newFromDate, newToDate);
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
    setRefreshing(false);
  };

  // Load data on mount if not provided
  useEffect(() => {
    if (!initialDrdAnalyticsData || !initialSubmissionsData) {
      fetchAnalyticsData();
    }
  }, [userId]);

  const person: ApplicantPerson | null = drdAnalyticsData?.people?.[0] as ApplicantPerson | null ?? null;
  const filingCounts = person?.filingCounts;
  const approvalRate = person && person.totalApplications > 0
    ? ((person.approvedCount / person.totalApplications) * 100).toFixed(1)
    : '0.0';

  const universityAverage = drdAnalyticsData?.extensions?.universityAverage as
    | { research: number; book: number; conference: number; ipr: number; grants: number; totalSubmissions: number; totalApplicants: number }
    | undefined;

  // Build radar datasets when both person + uni avg are available
  const radarAxes: RadarAxis[] = [
    { key: 'research', label: 'Research' },
    { key: 'book', label: 'Book / chapter' },
    { key: 'conference', label: 'Conference' },
    { key: 'ipr', label: 'IPR / patent' },
    { key: 'grants', label: 'Grants' },
  ];

  const radarDatasets: RadarDataSet[] | null = filingCounts && universityAverage
    ? [
        {
          label: person?.applicantName ?? 'You',
          color: VIZ[0],
          values: {
            research: filingCounts.research,
            book: filingCounts.book,
            conference: filingCounts.conference,
            ipr: filingCounts.ipr,
            grants: filingCounts.grants,
          },
        },
        {
          label: 'University average',
          color: VIZ[1],
          values: {
            research: universityAverage.research,
            book: universityAverage.book,
            conference: universityAverage.conference,
            ipr: universityAverage.ipr,
            grants: universityAverage.grants,
          },
        },
      ]
    : null;

  const header = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-wine dark:text-amber">Analytics</p>
        <h2 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-white">Comprehensive analytics</h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">
          Detailed submission and research tracker data
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDateFilters(!showDateFilters)}
          aria-pressed={showDateFilters}
          className={showDateFilters
            ? `${ui.btnSecondary} border-wine/40 bg-wine/5 text-wine dark:border-amber/40 dark:bg-wine/20 dark:text-amber`
            : ui.btnSecondary}
        >
          <Calendar className="h-4 w-4" />
          Date filters
        </button>

        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className={`${ui.btnSecondary} disabled:opacity-50`}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );

  const dateFilterPanel = showDateFilters && (
    <div className={`${ui.card} p-4`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/50" role="group" aria-label="Quick date ranges">
          {quickRanges.map((qr) => {
            const active = qr.from === fromDate && qr.to === toDate;
            return (
              <button
                key={qr.label}
                aria-pressed={active}
                onClick={() => handleDateFilterChange(qr.from, qr.to)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber'
                    : 'text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                {qr.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={ui.input}
          />
          <span className="text-xs text-stone-400 dark:text-gray-500">to</span>
          <input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={ui.input}
          />
        </div>
        <button
          onClick={() => handleDateFilterChange(fromDate, toDate)}
          disabled={loading}
          className={`${ui.btnPrimary} sm:ml-auto`}
        >
          <Filter className="h-4 w-4" />
          Apply
        </button>
      </div>
    </div>
  );

  // Show empty state only if not loading and no data
  if (!loading && (!drdAnalyticsData || !person)) {
    return (
      <div className="space-y-6">
        {header}
        {dateFilterPanel}

        <div className={`${ui.card} px-6 py-12 text-center`}>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-500 dark:bg-gray-700 dark:text-gray-300">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
            No analytics data available
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500 dark:text-gray-400">
            Comprehensive analytics could not be loaded for this profile. Try adjusting the date range or refreshing the data.
          </p>
        </div>
      </div>
    );
  }

  const trackerStats = trackerWorks
    ? [
        { label: 'Tracked', value: trackerWorks.totalTrackers, dot: 'bg-stone-400 dark:bg-gray-500' },
        { label: 'Ongoing', value: trackerWorks.ongoingCount, dot: 'bg-amber-500' },
        { label: 'Completed', value: trackerWorks.completedCount, dot: 'bg-emerald-500' },
        { label: 'Published', value: trackerWorks.publishedCount, dot: 'bg-emerald-700 dark:bg-emerald-300' },
        { label: 'Rejected', value: trackerWorks.rejectedCount, dot: 'bg-red-500' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Drawer */}
      {drawerCategory && person && userId && (
        <SubmissionsDrawer
          personId={userId}
          personName={person.applicantName}
          category={drawerCategory}
          fromDate={fromDate}
          toDate={toDate}
          data={drawerData}
          loading={drawerLoading}
          onClose={handleCloseDrawer}
        />
      )}

      {header}
      {dateFilterPanel}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4" aria-busy="true" aria-label="Loading analytics data">
          <div className="h-28 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
        </div>
      )}

      {/* Headline numbers */}
      {(person || trackerWorks) && (
        <div className={`overflow-hidden ${ui.card}`}>
          {person && (
            <dl className="grid grid-cols-2 sm:grid-cols-4">
              {[
                { label: 'Total submitted', value: person.totalApplications.toLocaleString('en-IN') },
                { label: 'Approved', value: person.approvedCount.toLocaleString('en-IN') },
                { label: 'Approval rate', value: `${approvalRate}%` },
                { label: 'Incentive earned', value: `₹${Number(person.totalIncentive).toLocaleString('en-IN')}` },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className={`border-stone-200 px-5 py-4 dark:border-gray-700 ${i > 0 ? 'border-l' : ''} ${i >= 2 ? 'max-sm:border-t' : ''} ${i === 2 ? 'max-sm:border-l-0' : ''}`}
                >
                  <dt className={ui.label}>{s.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-stone-900 dark:text-white">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {trackerWorks && trackerWorks.totalTrackers > 0 && (
            <div className={`flex flex-wrap items-center gap-2 bg-stone-50/60 px-5 py-3 dark:bg-gray-900/40 ${person ? 'border-t border-stone-200 dark:border-gray-700' : ''}`}>
              <span className={`mr-1 ${ui.label}`}>Research tracker</span>
              {trackerStats.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                  <span className="text-stone-600 dark:text-gray-300">{s.label}</span>
                  <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{s.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category breakdown */}
      {filingCounts && !loading && (
        <AnalyticsPanel
          title="Submissions by category"
          subtitle="Distribution across research categories. Select a category to see its submissions."
          icon={<Layers3 />}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {(Object.entries(CATEGORY_META) as [CategoryKey, typeof CATEGORY_META[CategoryKey]][]).map(([key, meta]) => {
              const count = filingCounts[key] ?? 0;
              return (
                <button
                  key={key}
                  onClick={() => handleCategoryClick(key, count)}
                  disabled={count === 0}
                  className={`flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4 text-left transition-colors dark:border-gray-700 dark:bg-gray-800 ${
                    count > 0
                      ? 'cursor-pointer hover:border-stone-300 hover:bg-stone-50 dark:hover:border-gray-500 dark:hover:bg-gray-700/40'
                      : 'cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-gray-300">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: categoryColor(key) }} />
                      {meta.label}
                    </span>
                    {count > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-gray-500" />}
                  </div>
                  <div className={`text-2xl font-semibold tabular-nums ${count > 0 ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-gray-600'}`}>{count}</div>
                  {person && person.totalApplications > 0 && (
                    <div className="text-xs tabular-nums text-stone-500 dark:text-gray-400">
                      {((count / person.totalApplications) * 100).toFixed(0)}% of total
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </AnalyticsPanel>
      )}

      {/* University comparison */}
      {radarDatasets && (
        <RadarComparisonChart
          axes={radarAxes}
          datasets={radarDatasets}
          title="Performance vs university average"
          subtitle={`How ${person?.applicantName ?? 'this researcher'} compares with the university-wide average across ${universityAverage?.totalApplicants ?? '—'} active researchers.`}
          size={320}
        />
      )}

      {/* Tracker works */}
      {trackerWorks && (
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsPanel
            title="Published / completed works"
            subtitle="Work items that have reached accepted or published milestones in the tracker."
            icon={<CheckCircle2 />}
          >
            {trackerWorks.completedWorks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-stone-200 p-6 text-center text-sm text-stone-500 dark:border-gray-700 dark:text-gray-400">
                No completed or published works in this period.
              </div>
            ) : (
              <div className="space-y-3">
                {trackerWorks.completedWorks.map((work) => (
                  <TrackerWorkCard key={work.id} work={work} />
                ))}
              </div>
            )}
          </AnalyticsPanel>

          <AnalyticsPanel
            title="Ongoing works"
            subtitle="Research still moving through writing, communication or submission."
            icon={<Clock />}
          >
            {trackerWorks.ongoingWorks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-stone-200 p-6 text-center text-sm text-stone-500 dark:border-gray-700 dark:text-gray-400">
                No ongoing works in this period.
              </div>
            ) : (
              <div className="space-y-3">
                {trackerWorks.ongoingWorks.map((work) => (
                  <TrackerWorkCard key={work.id} work={work} />
                ))}
              </div>
            )}
          </AnalyticsPanel>
        </div>
      )}

      {/* Research activity distribution */}
      <AnalyticsPanel
        title="Research activity distribution"
        subtitle="Share of each submission category in this researcher's profile."
        icon={<TrendingUp />}
      >
        <div className="space-y-3">
          {filingCounts && person &&
            (Object.entries(CATEGORY_META) as [CategoryKey, typeof CATEGORY_META[CategoryKey]][]).map(([key, meta]) => {
              const count = filingCounts[key] ?? 0;
              const pct = person.totalApplications > 0 ? (count / person.totalApplications) * 100 : 0;
              return (
                <div key={key} className="flex w-full items-center gap-3">
                  <div className="w-28 shrink-0 truncate text-xs font-medium text-stone-600 dark:text-gray-300 sm:w-36">
                    {meta.label}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                        backgroundColor: categoryColor(key),
                      }}
                    />
                  </div>
                  <div className={`w-20 shrink-0 text-right text-xs tabular-nums ${count > 0 ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>
                    {count} <span className="text-stone-400 dark:text-gray-500">({pct.toFixed(0)}%)</span>
                  </div>
                </div>
              );
            })}
        </div>
      </AnalyticsPanel>

      {/* Monthly trend */}
      {drdAnalyticsData?.extensions?.monthlyTrend && (
        <TrendChartPanel
          title="Monthly submission trend"
          subtitle="Submissions per month by category, with approvals."
          data={(drdAnalyticsData.extensions.monthlyTrend as any[]).map((m) => ({
            label: m.label || m.month,
            values: {
              total: m.totalApplications || 0,
              research: m.research || 0,
              ipr: m.ipr || 0,
              grants: m.grants || 0,
              approved: m.approvedCount || 0,
            },
          }))}
          keys={[
            { key: 'total', label: 'Total' },
            { key: 'research', label: 'Research' },
            { key: 'ipr', label: 'IPR' },
            { key: 'grants', label: 'Grants' },
            { key: 'approved', label: 'Approved' },
          ]}
          height={240}
        />
      )}

      {/* School / department context */}
      {(drdAnalyticsData?.schoolWise?.length || drdAnalyticsData?.departmentWise?.length) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {drdAnalyticsData?.schoolWise?.map((s: any) => (
            <ContextCard
              key={s.schoolId}
              icon={<GraduationCap className="h-4 w-4" />}
              title={s.schoolName}
              applications={s.totalApplications}
              approved={s.totalApproved}
              incentive={s.totalIncentive}
            />
          ))}
          {drdAnalyticsData?.departmentWise?.map((d: any) => (
            <ContextCard
              key={d.departmentId}
              icon={<Layers3 className="h-4 w-4" />}
              title={d.departmentName}
              meta={d.schoolName}
              applications={d.totalApplications}
              approved={d.totalApproved}
              incentive={d.totalIncentive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContextCard({
  icon, title, meta, applications, approved, incentive,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  applications: number;
  approved: number;
  incentive: number;
}) {
  return (
    <div className={`${ui.card} p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500 dark:bg-gray-700 dark:text-gray-300">{icon}</span>
        <h3 className="min-w-0 truncate text-sm font-semibold text-stone-800 dark:text-gray-100">
          {title}
          {meta && <span className="ml-1 text-xs font-normal text-stone-500 dark:text-gray-400">({meta})</span>}
        </h3>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-stone-500 dark:text-gray-400">Applications</dt>
          <dd className={`mt-0.5 text-lg ${ui.value}`}>{(applications || 0).toLocaleString('en-IN')}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500 dark:text-gray-400">Approved</dt>
          <dd className={`mt-0.5 text-lg ${ui.value}`}>{(approved || 0).toLocaleString('en-IN')}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500 dark:text-gray-400">Incentive</dt>
          <dd className={`mt-0.5 text-lg ${ui.value}`}>₹{(incentive || 0).toLocaleString('en-IN')}</dd>
        </div>
      </dl>
    </div>
  );
}
