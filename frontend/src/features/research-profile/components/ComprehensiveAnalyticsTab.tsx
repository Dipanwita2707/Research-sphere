'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
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
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  User2,
  Wallet,
  X,
  XCircle,
  Calendar,
  Filter,
} from 'lucide-react';
import { AnalyticsHero, AnalyticsPanel, KpiCardGrid, TrendChartPanel, RadarComparisonChart } from '@/components/analytics';
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

const CATEGORY_META: Record<CategoryKey, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  research: {
    label: 'Research Papers',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  book: {
    label: 'Book / Chapter',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  conference: {
    label: 'Conference Papers',
    icon: <Layers3 className="w-4 h-4" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  ipr: {
    label: 'IPR / Patents',
    icon: <Lightbulb className="w-4 h-4" />,
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  grants: {
    label: 'Grants',
    icon: <Wallet className="w-4 h-4" />,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  approved:           { label: 'Approved', color: 'bg-emerald-100 text-emerald-800' },
  completed:          { label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  drd_head_approved:  { label: 'DRD Approved', color: 'bg-emerald-100 text-emerald-800' },
  published:          { label: 'Published', color: 'bg-blue-100 text-blue-800' },
  submitted_to_govt:  { label: 'Submitted to Govt', color: 'bg-blue-100 text-blue-800' },
  under_review:       { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800' },
  changes_required:   { label: 'Changes Required', color: 'bg-orange-100 text-orange-800' },
  resubmitted:        { label: 'Resubmitted', color: 'bg-yellow-100 text-yellow-700' },
  rejected:           { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  drd_rejected:       { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  submitted:          { label: 'Submitted', color: 'bg-gray-100 text-gray-700' },
  recommended:        { label: 'Recommended', color: 'bg-teal-100 text-teal-800' },
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
  const meta = STATUS_META[status] || { label: status.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
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
  return <span className="text-xs text-gray-400">{labels[type] || type.replace(/_/g, ' ')}</span>;
}

function TrackerWorkStatusBadge({ status }: { status: ProgressTrackerRecord['currentStatus'] }) {
  const palette: Record<string, string> = {
    writing: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    communicated: 'border-amber-200 bg-amber-50 text-amber-700',
    submitted: 'border-blue-200 bg-blue-50 text-blue-700',
    accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    published: 'border-green-200 bg-green-50 text-green-700',
    rejected: 'border-red-200 bg-red-50 text-red-700',
  };
  const label = status.replace(/_/g, ' ');
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${palette[status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>{label}</span>;
}

function TrackerWorkCard({ work }: { work: ProgressTrackerRecord }) {
  return (
    <div className="rounded-[22px] border border-slate-200/70 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              {publicationTypeLabel(work.publicationType)}
            </span>
            <TrackerWorkStatusBadge status={work.currentStatus} />
          </div>
          <h4 className="mt-3 text-sm font-semibold tracking-tight text-slate-900">{work.title}</h4>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{work.trackingNumber}</span>
            {work.researchContribution?.applicationNumber && <span>Linked: {work.researchContribution.applicationNumber}</span>}
            <span>{work.schoolName}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <p className="font-medium text-slate-700">Started</p>
          <p className="mt-1">{fmtDate(work.createdAt)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <p className="font-medium text-slate-700">Expected / Actual</p>
          <p className="mt-1">{fmtDate(work.actualCompletionDate || work.expectedCompletionDate)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <p className="font-medium text-slate-700">Last Movement</p>
          <p className="mt-1">{fmtDate(work.latestStatusChangedAt || work.updatedAt)}</p>
        </div>
      </div>
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
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Drawer header */}
        <div className={`px-6 py-4 flex items-center gap-3 border-b border-gray-100 ${meta.bg}`}>
          <div className={`p-2 rounded-lg border ${meta.border} bg-white/70`}>
            <span className={meta.color}>{meta.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`font-semibold text-base ${meta.color}`}>{meta.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{personName}</p>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
              <span className="font-semibold text-gray-800">{data.approvedCount}</span> approved /
              <span className="font-semibold text-gray-800">{data.totalCount}</span> total
            </div>
          )}
          <button
            onClick={onClose}
            className="ml-2 p-1.5 rounded-lg hover:bg-white/80 transition-colors shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="px-6 py-3 border-b border-gray-100 flex gap-2">
          {(['all', 'approved', 'other'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f ? 'bg-[#011f4b] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'approved' ? 'Approved' : 'Pending / Others'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
              <FileText className="w-10 h-10" />
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

function SubmissionCard({ sub }: { sub: PersonSubmission }) {
  const link = sub.doi
    ? (sub.doi.startsWith('http') ? sub.doi : `https://doi.org/${sub.doi}`)
    : sub.weblink || null;

  return (
    <div className={`rounded-xl border p-4 ${sub.isApproved ? 'border-emerald-100 bg-emerald-50/30' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start gap-2 mb-1.5">
            {sub.isApproved ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-snug">{sub.title}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <PubTypeLabel type={sub.publicationType} />
                <StatusBadge status={sub.status} />
                {sub.applicationNumber && (
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <Hash className="w-2.5 h-2.5" />{sub.applicationNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pl-6">
            {sub.venue && (
              <div className="col-span-2 text-xs text-gray-600 flex items-center gap-1">
                <FileText className="w-3 h-3 text-gray-400" />
                <span className="font-medium truncate">{sub.venue}</span>
              </div>
            )}
            {sub.submittedAt && (
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-300" />
                Submitted: {fmtDate(sub.submittedAt)}
              </div>
            )}
            {sub.publicationDate && (
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-gray-300" />
                Published: {fmtDate(sub.publicationDate)}
              </div>
            )}
            {sub.indexedIn && (
              <div className="text-xs text-gray-500">Indexed: <span className="font-medium text-gray-700">{sub.indexedIn}</span></div>
            )}
            {sub.quartile && (
              <div className="text-xs text-gray-500">Quartile: <span className="font-medium text-gray-700">{sub.quartile}</span></div>
            )}
            {sub.impactFactor != null && (
              <div className="text-xs text-gray-500">IF: <span className="font-medium text-gray-700">{sub.impactFactor}</span></div>
            )}
            {sub.naasRating != null && (
              <div className="text-xs text-gray-500">NAAS: <span className="font-medium text-gray-700">{sub.naasRating}</span></div>
            )}
            {sub.extra?.iprType && (
              <div className="text-xs text-gray-500">Type: <span className="font-medium text-gray-700 capitalize">{sub.extra.iprType}</span></div>
            )}
            {sub.extra?.filingType && (
              <div className="text-xs text-gray-500">Filing: <span className="font-medium text-gray-700 capitalize">{sub.extra.filingType}</span></div>
            )}
            {sub.extra?.govtApplicationId && (
              <div className="col-span-2 text-xs text-gray-500">Govt ID: <span className="font-medium text-gray-700">{sub.extra.govtApplicationId}</span></div>
            )}
            {sub.extra?.fundingAgencyName && (
              <div className="col-span-2 text-xs text-gray-500">Agency: <span className="font-medium text-gray-700">{sub.extra.fundingAgencyName}</span></div>
            )}
            {sub.extra?.submittedAmount != null && (
              <div className="text-xs text-gray-500">Proposed: <span className="font-medium text-gray-700">{fmtCurrency(sub.extra.submittedAmount)}</span></div>
            )}
            {sub.nationalInternational && (
              <div className="text-xs text-gray-500">Scope: <span className="font-medium text-gray-700 capitalize">{sub.nationalInternational}</span></div>
            )}
          </div>

          {/* Incentive + link row */}
          <div className="flex items-center justify-between mt-2 pl-6">
            <div className="flex items-center gap-3">
              {sub.incentiveAmount != null && sub.incentiveAmount > 0 && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {fmtCurrency(sub.incentiveAmount)} incentive
                </span>
              )}
              {sub.pointsAwarded != null && sub.pointsAwarded > 0 && (
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
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
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> View Paper
              </a>
            )}
          </div>
        </div>
      </div>
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
      });
      
      if (response.data) {
        setDrawerData(response.data);
      }
    } catch (err) {
      logger.error('Failed to load drawer submissions', err);
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
        drdAnalyticsService.getApplicantPersonAnalytics(userId, filters),
        drdAnalyticsService.getApplicantPersonSubmissions(userId, filters).catch(() => null),
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
      logger.error('Failed to load analytics data', err);
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
    { key: 'book', label: 'Book / Chapter' },
    { key: 'conference', label: 'Conference' },
    { key: 'ipr', label: 'IPR / Patent' },
    { key: 'grants', label: 'Grants' },
  ];

  const radarDatasets: RadarDataSet[] | null = filingCounts && universityAverage
    ? [
        {
          label: person?.applicantName ?? 'You',
          color: '#6366f1',
          values: {
            research: filingCounts.research,
            book: filingCounts.book,
            conference: filingCounts.conference,
            ipr: filingCounts.ipr,
            grants: filingCounts.grants,
          },
        },
        {
          label: 'University Average',
          color: '#06b6d4',
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

  // Show empty state only if not loading and no data
  if (!loading && (!drdAnalyticsData || !person)) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Comprehensive Analytics</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Detailed submission and research tracker data
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDateFilters(!showDateFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showDateFilters
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Date Filters
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {showDateFilters && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => handleDateFilterChange(fromDate, toDate)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Apply Filters
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => handleDateFilterChange(isoDate(new Date(Date.now() - 30 * 86400e3)), isoDate(new Date()))}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Last 30 days
              </button>
              <button
                onClick={() => handleDateFilterChange(isoDate(new Date(Date.now() - 90 * 86400e3)), isoDate(new Date()))}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Last 3 months
              </button>
              <button
                onClick={() => handleDateFilterChange(isoDate(new Date(Date.now() - 365 * 86400e3)), isoDate(new Date()))}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Last year
              </button>
              <button
                onClick={() => handleDateFilterChange(isoDate(new Date(new Date().getFullYear(), 0, 1)), isoDate(new Date()))}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                This year
              </button>
            </div>
          </div>
        )}
        
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200/50 dark:border-gray-700/50 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Analytics Data Available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive analytics data could not be loaded for this profile. Try adjusting the date range or refreshing the data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      {/* Header with Date Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Comprehensive Analytics</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Detailed submission and research tracker data
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Date Filter Toggle */}
          <button
            onClick={() => setShowDateFilters(!showDateFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showDateFilters
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Date Filters
          </button>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Filter Panel */}
      {showDateFilters && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => handleDateFilterChange(fromDate, toDate)}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => handleDateFilterChange(isoDate(new Date(Date.now() - 30 * 86400e3)), isoDate(new Date()))}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Last 30 days
            </button>
            <button
              onClick={() => handleDateFilterChange(isoDate(new Date(Date.now() - 90 * 86400e3)), isoDate(new Date()))}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Last 3 months
            </button>
            <button
              onClick={() => handleDateFilterChange(isoDate(new Date(Date.now() - 365 * 86400e3)), isoDate(new Date()))}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Last year
            </button>
            <button
              onClick={() => handleDateFilterChange(isoDate(new Date(new Date().getFullYear(), 0, 1)), isoDate(new Date()))}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              This year
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200/50 dark:border-gray-700/50 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Loading Analytics Data
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching comprehensive analytics for the selected date range...
          </p>
        </div>
      )}

      {/* Summary KPIs */}
      {person && (
        <KpiCardGrid
          cards={[
            {
              label: 'Total Submissions',
              value: person.totalApplications,
              icon: <BarChart3 className="w-4 h-4" />,
            },
            {
              label: 'Approved',
              value: person.approvedCount,
              icon: <CheckCircle2 className="w-4 h-4" />,
            },
            {
              label: 'Approval Rate',
              value: Number(approvalRate),
              format: 'percent',
              icon: <TrendingUp className="w-4 h-4" />,
            },
            {
              label: 'Incentive Earned',
              value: person.totalIncentive,
              format: 'currency',
              icon: <Award className="w-4 h-4" />,
            },
          ]}
        />
      )}

      {/* Tracker Works KPIs */}
      {trackerWorks && trackerWorks.totalTrackers > 0 && (
        <KpiCardGrid
          cards={[
            { label: 'Tracked Works', value: trackerWorks.totalTrackers, icon: <Layers3 className="w-4 h-4" /> },
            { label: 'Ongoing Works', value: trackerWorks.ongoingCount, icon: <Clock className="w-4 h-4" /> },
            { label: 'Completed Works', value: trackerWorks.completedCount, icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: 'Published Works', value: trackerWorks.publishedCount, icon: <Award className="w-4 h-4" /> },
            { label: 'Rejected Works', value: trackerWorks.rejectedCount, icon: <XCircle className="w-4 h-4" /> },
          ]}
        />
      )}

      {/* Category Breakdown */}
      {filingCounts && !loading && (
        <AnalyticsPanel 
          title="Submission Breakdown by Category" 
          subtitle="Distribution of submissions across different research categories. Click to view details." 
          icon={<Layers3 className="w-4 h-4" />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {(Object.entries(CATEGORY_META) as [CategoryKey, typeof CATEGORY_META[CategoryKey]][]).map(([key, meta]) => {
              const count = filingCounts[key] ?? 0;
              return (
                <button
                  key={key}
                  onClick={() => handleCategoryClick(key, count)}
                  disabled={count === 0}
                  className={`rounded-xl p-4 flex flex-col gap-2 border transition-all text-left
                    ${meta.bg} ${meta.border}
                    ${count > 0 ? 'hover:shadow-md cursor-pointer hover:scale-105' : 'opacity-50 cursor-not-allowed'}
                  `}
                >
                  <div className={`flex items-center justify-between ${meta.color}`}>
                    <div className="flex items-center gap-1.5">
                      {meta.icon}
                      <span className="text-xs font-medium">{meta.label}</span>
                    </div>
                    {count > 0 && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                  </div>
                  <div className={`text-2xl font-bold ${meta.color}`}>{count}</div>
                  {person && person.totalApplications > 0 && (
                    <div className="text-xs text-gray-500">
                      {((count / person.totalApplications) * 100).toFixed(0)}% of total
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </AnalyticsPanel>
      )}

      {/* University Comparison Radar Chart */}
      {radarDatasets && (
        <AnalyticsPanel
          title="Performance vs University Average"
          subtitle={`How ${person?.applicantName ?? 'this researcher'} compares against the university-wide average across ${universityAverage?.totalApplicants ?? '—'} active researchers.`}
          icon={<Sparkles className="w-4 h-4" />}
        >
          <RadarComparisonChart
            axes={radarAxes}
            datasets={radarDatasets}
            title="Category-wise Comparison"
            subtitle="Individual submissions vs university average per category"
            size={320}
          />
        </AnalyticsPanel>
      )}

      {/* Tracker Works */}
      {trackerWorks && (
        <div className="grid gap-4 xl:grid-cols-2">
          <AnalyticsPanel
            title="Published / Completed Works"
            subtitle="Work items that have reached accepted or published milestones in the tracker."
            icon={<CheckCircle2 className="h-4 w-4" />}
          >
            {trackerWorks.completedWorks.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-400">
                No completed or published works found in this time window.
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
            title="Ongoing Works"
            subtitle="Research work still moving through writing, communication, or submission stages."
            icon={<Clock className="h-4 w-4" />}
          >
            {trackerWorks.ongoingWorks.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-400">
                No active ongoing works found in this time window.
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

      {/* Research Activity Distribution */}
      <AnalyticsPanel 
        title="Research Activity Distribution" 
        subtitle="Share of each submission category inside this researcher's profile." 
        icon={<TrendingUp className="h-4 w-4" />}
      >
        <div className="space-y-3">
          {filingCounts && person &&
            (Object.entries(CATEGORY_META) as [CategoryKey, typeof CATEGORY_META[CategoryKey]][]).map(([key, meta]) => {
              const count = filingCounts[key] ?? 0;
              const pct = person.totalApplications > 0 ? (count / person.totalApplications) * 100 : 0;
              return (
                <div key={key} className={`w-full flex items-center gap-3 group`}>
                  <div className={`w-32 text-xs font-medium ${meta.color} shrink-0 text-left`}>
                    {meta.label}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all"
                      style={{
                        width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                        backgroundColor:
                          key === 'research' ? '#3b82f6' :
                          key === 'book' ? '#8b5cf6' :
                          key === 'conference' ? '#f59e0b' :
                          key === 'ipr' ? '#ef4444' : '#10b981',
                      }}
                    />
                  </div>
                  <div className="w-14 text-right text-xs text-gray-500 shrink-0">
                    {count} ({pct.toFixed(0)}%)
                  </div>
                </div>
              );
            })}
        </div>
      </AnalyticsPanel>

      {/* Monthly Trend */}
      {drdAnalyticsData?.extensions?.monthlyTrend && (
        <TrendChartPanel
          title="Monthly Submission Trend"
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
            { key: 'total', label: 'Total', color: '#6366f1' },
            { key: 'research', label: 'Research', color: '#3b82f6' },
            { key: 'ipr', label: 'IPR', color: '#f59e0b' },
            { key: 'grants', label: 'Grants', color: '#8b5cf6' },
            { key: 'approved', label: 'Approved', color: '#10b981' },
          ]}
          height={200}
        />
      )}

      {/* School / Department Context */}
      {(drdAnalyticsData?.schoolWise?.length || drdAnalyticsData?.departmentWise?.length) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drdAnalyticsData?.schoolWise?.map((s: any) => (
            <div key={s.schoolId} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="w-4 h-4 text-[#011f4b]" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{s.schoolName}</h3>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{s.totalApplications}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Applications</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600">{s.totalApproved}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Approved</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600">
                    ₹{(s.totalIncentive || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Incentive</div>
                </div>
              </div>
            </div>
          ))}
          {drdAnalyticsData?.departmentWise?.map((d: any) => (
            <div key={d.departmentId} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Layers3 className="w-4 h-4 text-[#011f4b]" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {d.departmentName}
                  <span className="text-xs text-gray-400 font-normal ml-1">({d.schoolName})</span>
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{d.totalApplications}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Applications</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600">{d.totalApproved}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Approved</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600">
                    ₹{(d.totalIncentive || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Incentive</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}