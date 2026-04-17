'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type ApplicantPersonTrackerWorks,
  type DrdAnalyticsResponse,
  type PersonSubmission,
  type PersonSubmissionsResponse,
  type ProgressTrackerRecord,
} from '@/features/ipr-management/services/drdAnalytics.service';
import { AnalyticsHero, AnalyticsPanel, AnalyticsShell, KpiCardGrid, TrendChartPanel, RadarComparisonChart } from '@/components/analytics';
import type { RadarAxis, RadarDataSet } from '@/components/analytics';
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
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function is403(err: unknown): boolean {
  if (err && typeof err ===
   'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status ===
   403;
  }
  return false;
}

function is404(err: unknown): boolean {
  if (err && typeof err ===
   'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status ===
   404;
  }
  return false;
}

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

/* ──────────────────────────────────────────────────────────────────
   Submissions Drawer
   ────────────────────────────────────────────────────────────────── */
interface DrawerProps {
  personId: string;
  personName: string;
  category: CategoryKey;
  fromDate: string;
  toDate: string;
  onClose: () => void;
}

function SubmissionsDrawer({ personId, personName, category, fromDate, toDate, onClose }: DrawerProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PersonSubmissionsResponse | null>(null);
  const [filter, setFilter] = useState<'all' | 'approved' | 'other'>('all');
  const meta = CATEGORY_META[category];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    drdAnalyticsService
      .getApplicantPersonSubmissions(personId, { from: fromDate, to: toDate, category })
      .then((res) => {
        if (!cancelled && res.data) setData(res.data);
      })
      .catch((err) => logger.error('Failed to load submissions', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personId, fromDate, toDate, category]);

  const submissions = data?.submissions ?? [];
  const visible =
    filter ===
   'approved' ? submissions.filter((s) => s.isApproved) :
    filter ===
   'other'    ? submissions.filter((s) => !s.isApproved) :
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
                filter ===
   f ? 'bg-[#011f4b] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f ===
   'all' ? 'All' : f ===
   'approved' ? 'Approved' : 'Pending / Others'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
            </div>
          ) : visible.length ===
   0 ? (
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
   Main Page
   ────────────────────────────────────────────────────────────────── */
export default function ApplicantProfilePage() {
  const router = useRouter();
  const { personId } = useParams<{ personId: string }>();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<DrdAnalyticsResponse | null>(null);
  const [fromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate] = useState(isoDate(new Date()));
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);

  const person: ApplicantPerson | null =
    data?.people?.[0] as ApplicantPerson | null ?? null;

  const fetchData = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    try {
      const res = await drdAnalyticsService.getApplicantPersonAnalytics(personId, {
        from: fromDate,
        to: toDate,
      });
      if (res.data) setData(res.data);
    } catch (err) {
      if (is403(err)) setAccessDenied(true);
      else if (is404(err)) setNotFound(true);
      logger.error('Failed to load person analytics', err);
    } finally {
      setLoading(false);
    }
  }, [personId, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filingCounts = person?.filingCounts;
  const approvalRate =
    person && person.totalApplications > 0
      ? ((person.approvedCount / person.totalApplications) * 100).toFixed(1)
      : '0.0';
  const trackerWorks = data?.extensions?.trackerWorks as ApplicantPersonTrackerWorks | undefined;
  const universityAverage = data?.extensions?.universityAverage as
    | { research: number; book: number; conference: number; ipr: number; grants: number; totalSubmissions: number; totalApplicants: number }
    | undefined;

  /* Build radar datasets when both person + uni avg are available */
  const radarAxes: RadarAxis[] = [
    { key: 'research', label: 'Research' },
    { key: 'book', label: 'Book / Chapter' },
    { key: 'conference', label: 'Conference' },
    { key: 'ipr', label: 'IPR / Patent' },
    { key: 'grants', label: 'Grants' },
  ];
  const radarDatasets: RadarDataSet[] | null =
    filingCounts && universityAverage
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

  return (
    <ProtectedRoute>
      {/* Drawer */}
      {activeCategory && person && (
        <SubmissionsDrawer
          personId={personId}
          personName={person.applicantName}
          category={activeCategory}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setActiveCategory(null)}
        />
      )}

      {accessDenied ? (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500 mb-6 text-sm">
              You don&apos;t have permission to view this applicant&apos;s profile.
            </p>
            <button
              onClick={() => router.back()}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      ) : notFound ? (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border">
            <User2 className="w-10 h-10 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Profile Not Found</h2>
            <p className="text-gray-500 mb-6 text-sm">
              No analytics data found for this applicant in the selected date range.
            </p>
            <button
              onClick={() => router.push('/drd/analytics/applicant')}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Back to Leaderboard
            </button>
          </div>
        </div>
      ) : (
        <AnalyticsShell>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex justify-end">
              <button
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/60 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-md transition-all hover:bg-white/90 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <AnalyticsHero
              title={person?.applicantName ?? 'Applicant Profile'}
              description={person ? `${person.schoolName}${person.departmentName !== 'Unassigned' ? ` · ${person.departmentName}` : ''}. Unified submission and research tracker view for this applicant.` : 'Unified submission and research tracker view for this applicant.'}
              eyebrow="Research Profile"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              onBack={() => router.push('/drd/analytics/applicant')}
              chips={[
                { label: 'Applications', value: person ? String(person.totalApplications) : '—' },
                { label: 'Approved', value: person ? String(person.approvedCount) : '—' },
                { label: 'Tracker Works', value: trackerWorks ? String(trackerWorks.totalTrackers) : '0' },
                { label: 'Published', value: trackerWorks ? String(trackerWorks.publishedCount) : '0' },
              ]}
            />

            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
                      <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
                      <div className="h-6 bg-gray-200 rounded w-12" />
                    </div>
                  ))}
                </div>
              </div>
            ) : person ? (
              <>
                {/* Summary KPIs */}
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

                {/* Category Breakdown — clickable cards */}
                {filingCounts && (
                  <AnalyticsPanel title="Submission Breakdown by Category" subtitle="Click any category to inspect the actual submitted records." icon={<Layers3 className="w-4 h-4" />}>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Layers3 className="w-4 h-4" />
                      Submission Breakdown by Category
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">Click a card to see detailed records</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {(Object.entries(CATEGORY_META) as [CategoryKey, typeof CATEGORY_META[CategoryKey]][]).map(([key, meta]) => {
                        const count = filingCounts[key] ?? 0;
                        return (
                          <button
                            key={key}
                            onClick={() => count > 0 && setActiveCategory(key)}
                            disabled={count ===
   0}
                            className={`rounded-xl p-4 flex flex-col gap-2 border transition-all text-left
                              ${meta.bg} ${meta.border}
                              ${count > 0
                                ? 'hover:shadow-md hover:scale-[1.02] cursor-pointer active:scale-[0.98]'
                                : 'opacity-50 cursor-not-allowed'
                              }`}
                          >
                            <div className={`flex items-center justify-between ${meta.color}`}>
                              <div className="flex items-center gap-1.5">
                                {meta.icon}
                                <span className="text-xs font-medium">{meta.label}</span>
                              </div>
                              {count > 0 && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                            </div>
                            <div className={`text-2xl font-bold ${meta.color}`}>{count}</div>
                            {person.totalApplications > 0 && (
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

                {/* ── User vs University Average Radar ── */}
                {radarDatasets && (
                  <AnalyticsPanel
                    title="Performance vs University Average"
                    subtitle={`How ${person?.applicantName ?? 'this applicant'} compares against the university-wide average across ${universityAverage?.totalApplicants ?? '—'} active researchers.`}
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

                {trackerWorks && (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <AnalyticsPanel
                      title="Published / Completed Works"
                      subtitle="Work items that have reached accepted or published milestones in the tracker."
                      icon={<CheckCircle2 className="h-4 w-4" />}
                    >
                      {trackerWorks.completedWorks.length ===
   0 ? (
                        <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-400">No completed or published works found in this time window.</div>
                      ) : (
                        <div className="space-y-3">{trackerWorks.completedWorks.map((work) => <TrackerWorkCard key={work.id} work={work} />)}</div>
                      )}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                      title="Ongoing Works"
                      subtitle="Research work still moving through writing, communication, or submission stages."
                      icon={<Clock className="h-4 w-4" />}
                    >
                      {trackerWorks.ongoingWorks.length ===
   0 ? (
                        <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-400">No active ongoing works found in this time window.</div>
                      ) : (
                        <div className="space-y-3">{trackerWorks.ongoingWorks.map((work) => <TrackerWorkCard key={work.id} work={work} />)}</div>
                      )}
                    </AnalyticsPanel>
                  </div>
                )}

                {/* Per-category progress bars */}
                <AnalyticsPanel title="Research Activity Distribution" subtitle="Share of each submission category inside this applicant profile." icon={<TrendingUp className="h-4 w-4" />}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Research Activity Distribution</h3>
                  <div className="space-y-3">
                    {filingCounts &&
                      (Object.entries(CATEGORY_META) as [CategoryKey, typeof CATEGORY_META[CategoryKey]][]).map(([key, meta]) => {
                        const count = filingCounts[key] ?? 0;
                        const pct =
                          person.totalApplications > 0
                            ? (count / person.totalApplications) * 100
                            : 0;
                        return (
                          <button
                            key={key}
                            onClick={() => count > 0 && setActiveCategory(key)}
                            disabled={count ===
   0}
                            className={`w-full flex items-center gap-3 group ${count > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className={`w-32 text-xs font-medium ${meta.color} shrink-0 text-left group-hover:underline`}>
                              {meta.label}
                            </div>
                            <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                              <div
                                className="h-2.5 rounded-full transition-all"
                                style={{
                                  width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                                  backgroundColor:
                                    key ===
   'research' ? '#3b82f6' :
                                    key ===
   'book'     ? '#8b5cf6' :
                                    key ===
   'conference' ? '#f59e0b' :
                                    key ===
   'ipr'      ? '#ef4444' :
                                                         '#10b981',
                                }}
                              />
                            </div>
                            <div className="w-14 text-right text-xs text-gray-500 shrink-0">
                              {count} ({pct.toFixed(0)}%)
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </AnalyticsPanel>

                {/* Monthly Trend */}
                {data?.extensions?.monthlyTrend && (
                  <TrendChartPanel
                    title="Monthly Submission Trend"
                    data={(data.extensions.monthlyTrend as any[]).map((m) => ({
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

                {/* School / Department context */}
                {(data?.schoolWise?.length || data?.departmentWise?.length) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data?.schoolWise?.map((s: any) => (
                      <div key={s.schoolId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <GraduationCap className="w-4 h-4 text-[#011f4b]" />
                          <h3 className="text-sm font-semibold text-gray-700">{s.schoolName}</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <div className="text-xl font-bold text-gray-900">{s.totalApplications}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Applications</div>
                          </div>
                          <div>
                            <div className="text-xl font-bold text-emerald-600">{s.totalApproved}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Approved</div>
                          </div>
                          <div>
                            <div className="text-xl font-bold text-blue-600">
                              ₹{(s.totalIncentive || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">Incentive</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {data?.departmentWise?.map((d: any) => (
                      <div key={d.departmentId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Layers3 className="w-4 h-4 text-[#011f4b]" />
                          <h3 className="text-sm font-semibold text-gray-700">
                            {d.departmentName}
                            <span className="text-xs text-gray-400 font-normal ml-1">({d.schoolName})</span>
                          </h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <div className="text-xl font-bold text-gray-900">{d.totalApplications}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Applications</div>
                          </div>
                          <div>
                            <div className="text-xl font-bold text-emerald-600">{d.totalApproved}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Approved</div>
                          </div>
                          <div>
                            <div className="text-xl font-bold text-blue-600">
                              ₹{(d.totalIncentive || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">Incentive</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
                No data available.
              </div>
            )}
          </div>
        </AnalyticsShell>
      )}
    </ProtectedRoute>
  );
}

