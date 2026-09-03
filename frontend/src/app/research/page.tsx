'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  BookOpen, 
  Presentation, 
  DollarSign,
  Plus, 
  TrendingUp,
  Award,
  Coins,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { researchService, ResearchContribution, ResearchPublicationType } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import logger from '@/shared/utils/logger';

const PUBLICATION_TYPES = [
  { 
    type: 'research_paper' as ResearchPublicationType, 
    label: 'Research Paper', 
    icon: FileText, 
    accent: '#3b82f6',
    accentBg: 'bg-[#fdf5ec] dark:bg-blue-950/40',
    accentText: 'text-[#7d1a34] dark:text-[#c8973f]',
    accentBorder: 'border-[#f0e2d2] dark:border-[#5e1024]',
    description: 'Journal articles in indexed publications',
    href: '/research/apply?type=research_paper'
  },
  { 
    type: 'book' as ResearchPublicationType, 
    label: 'Book / Book Chapter', 
    icon: BookOpen, 
    accent: '#10b981',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    accentBorder: 'border-emerald-200 dark:border-emerald-800',
    description: 'Books and authored chapters',
    href: '/research/apply?type=book'
  },
  { 
    type: 'conference_paper' as ResearchPublicationType, 
    label: 'Conference Paper', 
    icon: Presentation, 
    accent: '#8b5cf6',
    accentBg: 'bg-violet-50 dark:bg-violet-950/40',
    accentText: 'text-violet-600 dark:text-violet-400',
    accentBorder: 'border-violet-200 dark:border-violet-800',
    description: 'Conference proceedings and presentations',
    href: '/research/apply?type=conference_paper'
  },
  { 
    type: 'grant_proposal' as ResearchPublicationType, 
    label: 'Grant / Funding', 
    icon: DollarSign, 
    accent: '#f59e0b',
    accentBg: 'bg-amber-50 dark:bg-amber-950/40',
    accentText: 'text-amber-600 dark:text-amber-400',
    accentBorder: 'border-amber-200 dark:border-amber-800',
    description: 'Research grants and funded projects',
    href: '/research/apply-grant'
  },
];

const STATUS_CONFIG = {
  draft:             { label: 'Draft',            dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  submitted:         { label: 'Submitted',         dot: 'bg-[#7d1a34]',    badge: 'bg-[#fdf5ec] text-[#7d1a34] dark:bg-blue-950/60 dark:text-[#c8973f]' },
  under_review:      { label: 'Under Review',      dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  changes_required:  { label: 'Changes Required',  dot: 'bg-orange-500',  badge: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' },
  resubmitted:       { label: 'Resubmitted',       dot: 'bg-[#7d1a34]',    badge: 'bg-[#fdf5ec] text-[#7d1a34] dark:bg-blue-950/60 dark:text-[#c8973f]' },
  approved:          { label: 'Approved',          dot: 'bg-green-500',   badge: 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300' },
  rejected:          { label: 'Rejected',          dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300' },
  completed:         { label: 'Completed',         dot: 'bg-indigo-500',  badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' },
};

export default function ResearchDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [contributions, setContributions] = useState<ResearchContribution[]>([]);
  const [contributedResearch, setContributedResearch] = useState<ResearchContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    drafts: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalIncentives: 0,
    totalPoints: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [myContribRes, contributedRes] = await Promise.all([
        researchService.getMyContributions().catch(() => ({ data: [] })),
        researchService.getContributedResearch().catch(() => ({ data: [] }))
      ]);

      const myContributions = myContribRes?.data?.contributions || myContribRes?.data || [];
      const contributed = contributedRes?.data?.contributions || contributedRes?.data || [];
      
      setContributions(myContributions);
      setContributedResearch(contributed);
      
      // Calculate stats
      const allContribs = [...myContributions, ...contributed.filter(
        (c: ResearchContribution) => !myContributions.some((m: ResearchContribution) => m.id ===
   c.id)
      )];
      
      const completedStatuses = ['approved', 'completed'];
      const completedContribs = allContribs.filter((c: ResearchContribution) => 
        completedStatuses.includes(c.status)
      );
      
      const totalIncentives = completedContribs.reduce((sum: number, c: ResearchContribution) => 
        sum + (Number(c.incentiveAmount) || 0), 0
      );
      
      const totalPoints = completedContribs.reduce((sum: number, c: ResearchContribution) => 
        sum + (Number(c.pointsAwarded) || 0), 0
      );
      
      setStats({
        total: myContributions.length,
        drafts: myContributions.filter((c: ResearchContribution) => c.status ===
   'draft').length,
        pending: myContributions.filter((c: ResearchContribution) => 
          ['submitted', 'under_review', 'resubmitted', 'changes_required'].includes(c.status)
        ).length,
        approved: myContributions.filter((c: ResearchContribution) => 
          ['approved', 'completed'].includes(c.status)
        ).length,
        rejected: myContributions.filter((c: ResearchContribution) => c.status ===
   'rejected').length,
        totalIncentives,
        totalPoints,
      });
    } catch (error) {
      logger.error('Error fetching research data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  };

  const recentContributions = Array.isArray(contributions) ? contributions.slice(0, 5) : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium tracking-wide uppercase">
                <Layers className="w-3.5 h-3.5" />
                Research Management
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Research &amp; Academic Contributions
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Track and manage your research publications, books, and grants
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              {user?.id && (
                <>
                  <Link
                    href="/research/my-profile"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Award className="w-4 h-4" />
                    My Profile
                  </Link>
                  <Link
                    href={`/research/profile/${user.id}/manage`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Manage Profile
                  </Link>
                </>
              )}
              <Link
                href="/research/apply"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#7d1a34] hover:bg-[#5e1024] rounded-lg transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Contribution
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Stats Bar ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-200 dark:divide-slate-800">

            {/* Total */}
            <div className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#fdf5ec] dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#7d1a34] dark:text-[#c8973f]" />
              </div>
              <div>
                {loading
                  ? <div className="h-7 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  : <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{stats.total}</p>}
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Total Submissions</p>
              </div>
            </div>

            {/* Pending */}
            <div className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                {loading
                  ? <div className="h-7 w-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  : <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{stats.pending}</p>}
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Under Review</p>
              </div>
            </div>

            {/* Incentives */}
            <div className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
                <Coins className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                {loading
                  ? <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  : <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">₹{stats.totalIncentives.toLocaleString()}</p>}
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Total Incentives</p>
              </div>
            </div>

            {/* Points */}
            <div className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                {loading
                  ? <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  : <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{stats.totalPoints}</p>}
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Points Earned</p>
              </div>
            </div>

          </div>
        </div>

        {/* ── Publication Types ───────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Submit a Contribution</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PUBLICATION_TYPES.map((pubType) => {
              const Icon = pubType.icon;
              const count = Array.isArray(contributions) ? contributions.filter(c => c.publicationType ===
   pubType.type).length : 0;
              return (
                <Link
                  key={pubType.type}
                  href={pubType.href}
                  className={`group relative bg-white dark:bg-slate-900 border ${pubType.accentBorder} rounded-xl p-5 hover:shadow-md transition-all duration-200 overflow-hidden`}
                >
                  {/* Accent top bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                    style={{ backgroundColor: pubType.accent }}
                  />
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${pubType.accentBg} mb-4`}>
                    <Icon className={`w-5 h-5 ${pubType.accentText}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 leading-snug">{pubType.label}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">{pubType.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{count} filed</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${pubType.accentText} group-hover:gap-2 transition-all`}>
                      Apply <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Recent Contributions ────────────────────────────────── */}
        {recentContributions.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recent Contributions</h2>
              <Link 
                href="/research/my-contributions"
                className="text-xs font-medium text-[#7d1a34] dark:text-[#c8973f] hover:text-[#7d1a34] dark:hover:text-[#c8973f] flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentContributions.map((contribution) => {
                const statusInfo = getStatusInfo(contribution.status);
                const pubType = PUBLICATION_TYPES.find(p => p.type ===
   contribution.publicationType);
                const Icon = pubType?.icon || FileText;
                
                return (
                  <Link
                    key={contribution.id}
                    href={`/research/contribution/${contribution.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${pubType?.accent}18` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: pubType?.accent || '#6b7280' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover:text-[#7d1a34] dark:group-hover:text-[#c8973f] transition-colors">
                          {contribution.title}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {contribution.applicationNumber || 'No app number'} · {pubType?.label || contribution.publicationType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                        {statusInfo.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty State ─────────────────────────────────────────── */}
        {!loading && contributions.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">No contributions yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Start by filing your first research contribution</p>
            <Link
              href="/research/apply"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7d1a34] text-white text-sm font-semibold rounded-lg hover:bg-[#5e1024] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              File New Contribution
            </Link>
          </div>
        )}

        {/* ── Loading Skeleton ─────────────────────────────────────── */}
        {loading && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                    <div>
                      <div className="h-3.5 w-52 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
                      <div className="h-3 w-36 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
