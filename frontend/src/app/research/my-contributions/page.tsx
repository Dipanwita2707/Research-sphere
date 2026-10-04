'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Send,
  RefreshCw,
  BookOpen,
  Presentation,
  DollarSign,
  Award,
  Coins,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  FolderOpen,
  Layers,
  Filter,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  CloudDownload,
} from 'lucide-react';
import { researchService, ResearchContribution, ResearchPublicationType, GrantApplication } from '@/features/research-management/services/research.service';
import { grantPolicyService, GrantIncentivePolicy } from '@/features/research-management/services/grantPolicy.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { getDuplicateClaimError } from '@/features/research-management/services/duplicateClaim';
import { logger } from '@/shared/utils/logger';
import { BRAND } from '@/shared/config/brand';

const W = BRAND.palette;

type TabType = 'all' | 'synced' | 'action_required' | 'draft' | 'in_progress' | 'completed';

const TABS: { key: TabType; label: string; icon: React.ElementType; dotColor: string }[] = [
  { key: 'all',             label: 'All',             icon: FolderOpen,    dotColor: '' },
  { key: 'synced',          label: 'Synced works',    icon: CloudDownload, dotColor: 'bg-emerald-500' },
  { key: 'action_required', label: 'Action Required', icon: AlertCircle,   dotColor: 'bg-amber' },
  { key: 'draft',           label: 'Drafts',          icon: Edit,          dotColor: 'bg-charcoal/40' },
  { key: 'in_progress',     label: 'In Progress',     icon: Clock,         dotColor: 'bg-wine' },
  { key: 'completed',       label: 'Completed',       icon: CheckCircle,   dotColor: 'bg-wine-dark' },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; dot: string; badge: string; borderColor: string; bgColor: string; color: string }> = {
  draft:                   { label: 'Draft',            icon: Edit,        dot: 'bg-charcoal/40', badge: 'bg-brand-50 text-charcoal/70',       borderColor: 'border-peach/60',  bgColor: 'bg-brand-50',   color: 'text-charcoal/70' },
  submitted:               { label: 'Submitted',        icon: Send,        dot: 'bg-wine',        badge: 'bg-peach/50 text-wine',              borderColor: 'border-peach',     bgColor: 'bg-ivory',      color: 'text-wine' },
  pending_mentor_approval: { label: 'Pending Mentor',   icon: Clock,       dot: 'bg-amber',       badge: 'bg-peach/40 text-amber-dark',        borderColor: 'border-peach',     bgColor: 'bg-ivory',      color: 'text-amber-dark' },
  under_review:            { label: 'Under Review',     icon: Clock,       dot: 'bg-amber',       badge: 'bg-peach/40 text-amber-dark',        borderColor: 'border-peach',     bgColor: 'bg-ivory',      color: 'text-amber-dark' },
  changes_required:        { label: 'Changes Required', icon: AlertCircle, dot: 'bg-amber',       badge: 'bg-peach text-amber-dark',           borderColor: 'border-amber/30',  bgColor: 'bg-peach/30',   color: 'text-amber-dark' },
  resubmitted:             { label: 'Resubmitted',      icon: RefreshCw,   dot: 'bg-wine',        badge: 'bg-peach/50 text-wine',              borderColor: 'border-peach',     bgColor: 'bg-ivory',      color: 'text-wine' },
  approved:                { label: 'Approved',         icon: CheckCircle, dot: 'bg-wine-dark',   badge: 'bg-peach/60 text-wine-dark',         borderColor: 'border-peach',     bgColor: 'bg-brand-50',   color: 'text-wine-dark' },
  rejected:                { label: 'Rejected',         icon: XCircle,     dot: 'bg-wine-darker', badge: 'bg-peach/30 text-wine-darker',       borderColor: 'border-peach',     bgColor: 'bg-brand-50',   color: 'text-wine-darker' },
  completed:               { label: 'Completed',        icon: CheckCircle, dot: 'bg-wine',        badge: 'bg-peach/60 text-wine',              borderColor: 'border-peach',     bgColor: 'bg-brand-50',   color: 'text-wine' },
};

/** Synced (auto-imported) drafts the researcher still has to act on. */
const isSyncedDraft = (c: ResearchContribution) => c.sourceType === 'auto_import' && c.status === 'draft';

const AFFILIATION_BASIS_LABEL: Record<string, string> = {
  scopus_afid: 'Scopus lists this university as your primary affiliation',
  trusted_query: 'Found by a Scopus search limited to this university',
  name_match: 'Your primary affiliation on the paper is this university',
  personal_alias: 'Your affiliation matches one of your saved aliases',
  orcid_employment: 'Your ORCID employment history places you here that year',
  orcid_employment_elsewhere: 'Your ORCID employment history places you at another institution that year',
  other_institution: 'Your affiliation on the paper is another institution',
  not_primary: 'This university is on the paper, but not as your primary (first) affiliation',
  name_match_openalex: 'Your affiliation on the paper (from OpenAlex) names this university',
  other_institution_openalex: 'Your affiliation on the paper (from OpenAlex) is another institution',
  not_primary_openalex: 'This university is on the paper (from OpenAlex), but not as your primary affiliation',
  no_data: 'The source gives no affiliation for you',
};

const AFFILIATION_BADGE = {
  affiliated:     { label: 'Affiliated · eligible', icon: ShieldCheck,    cls: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' },
  unknown:        { label: 'Affiliation unverified', icon: ShieldQuestion, cls: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' },
  not_affiliated: { label: 'Other institution · not eligible', icon: ShieldX, cls: 'bg-stone-100 text-stone-600 ring-1 ring-stone-200' },
} as const;

function AffiliationBadge({ c }: { c: ResearchContribution }) {
  if (c.sourceType !== 'auto_import' || !c.homeAffiliation) return null;
  const cfg = AFFILIATION_BADGE[c.homeAffiliation];
  const Icon = cfg.icon;
  const why = [AFFILIATION_BASIS_LABEL[c.homeAffiliationBasis || ''] || '', c.homeAffiliationDetail || ''].filter(Boolean).join(': ');
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`} title={why || undefined}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

const PUBLICATION_TYPE_CONFIG: Record<ResearchPublicationType, { label: string; icon: React.ElementType; color: string; gradient: string; accent: string; accentBg: string; accentText: string }> = {
  research_paper:   { label: 'Research Paper',   icon: FileText,     color: 'bg-wine',        gradient: 'from-wine to-wine-dark',       accent: W.wine,   accentBg: 'bg-peach/40', accentText: 'text-wine' },
  book:             { label: 'Book',              icon: BookOpen,     color: 'bg-amber',       gradient: 'from-amber to-amber-dark',   accent: W.amber,  accentBg: 'bg-peach/50', accentText: 'text-amber-dark' },
  book_chapter:     { label: 'Book Chapter',      icon: BookOpen,     color: 'bg-amber',       gradient: 'from-amber to-amber-dark',   accent: W.amber,  accentBg: 'bg-peach/50', accentText: 'text-amber-dark' },
  conference_paper: { label: 'Conference Paper',  icon: Presentation, color: 'bg-wine-dark',   gradient: 'from-wine-dark to-wine-darker', accent: W.wine, accentBg: 'bg-peach/35', accentText: 'text-wine-dark' },
  grant_proposal:   { label: 'Grant',             icon: DollarSign,   color: 'bg-amber-dark',  gradient: 'from-amber-dark to-wine',    accent: W.amber,  accentBg: 'bg-peach/45', accentText: 'text-amber-dark' },
};

export default function MyContributionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { confirmDelete, confirmAction } = useConfirm();
  const [contributions, setContributions] = useState<ResearchContribution[]>([]);
  const [grants, setGrants] = useState<GrantApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const t = searchParams?.get('tab');
    return t && TABS.some((x) => x.key === t) ? (t as TabType) : 'all';
  });
  const [showOtherInstitutions, setShowOtherInstitutions] = useState(false);
  // Navigating here again with another ?tab= (e.g. from the menu) switches the tab.
  const tabParam = searchParams?.get('tab');
  useEffect(() => {
    if (tabParam && TABS.some((x) => x.key === tabParam)) setActiveTab(tabParam as TabType);
  }, [tabParam]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [publicationTypeFilter, setPublicationTypeFilter] = useState<string>('');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    drafts: 0,
    action_required: 0,
    in_progress: 0,
    completed: 0,
    rejected: 0,
    totalIncentives: 0,
    totalPoints: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchContributions(), fetchGrants()]);
    };
    loadData();
  }, []);

  const fetchGrants = async () => {
    try {
      const response = await researchService.getMyGrantApplications();
      const data = response.data || [];
      setGrants(data);
      return data;
    } catch (error: unknown) {
      logger.error('Error fetching grant applications:', error);
      return [];
    }
  };

  const fetchContributions = async () => {
    try {
      setLoading(true);
      const response = await researchService.getMyContributions();
      const data = response.data?.contributions || response.data || [];
      setContributions(data);
      return data;
    } catch (error: unknown) {
      logger.error('Error fetching contributions:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getMyContributionShare = useCallback((contribution: ResearchContribution) => {
    const currentAuthor = contribution.authors?.find((author) => author.userId === user?.id);

    return {
      estimatedIncentive: Number(currentAuthor?.incentiveShare ?? contribution.calculatedIncentiveAmount ?? 0),
      estimatedPoints: Number(currentAuthor?.pointsShare ?? contribution.calculatedPoints ?? 0),
      creditedIncentive: Number(currentAuthor?.incentiveShare ?? contribution.incentiveAmount ?? 0),
      creditedPoints: Number(currentAuthor?.pointsShare ?? contribution.pointsAwarded ?? 0),
    };
  }, [user?.id]);

  // Calculate stats whenever contributions or grants change
  useEffect(() => {
    const actionRequiredStatuses = ['changes_required'];
    const inProgressStatuses = ['submitted', 'under_review', 'resubmitted', 'pending_mentor_approval'];
    const completedStatuses = ['approved', 'completed'];

    const completedContribs = contributions.filter((c: ResearchContribution) =>
      completedStatuses.includes(c.status)
    );

    // Calculate total incentives (credited only)
    const creditedIncentives = completedContribs.reduce((sum: number, c: ResearchContribution) =>
      sum + getMyContributionShare(c).creditedIncentive, 0
    );

    const creditedPoints = completedContribs.reduce((sum: number, c: ResearchContribution) =>
      sum + getMyContributionShare(c).creditedPoints, 0
    );

    // Add grant stats - calculate individual applicant's share
    const completedGrants = grants.filter((g: GrantApplication) =>
      ['approved', 'completed'].includes(g.status)
    );

    // Calculate individual share for each grant
    const calculateApplicantShare = (grant: GrantApplication) => {
      if (!grant.calculatedIncentiveAmount && !grant.calculatedPoints) {
        return { incentive: 0, points: 0 };
      }

      // Determine if applicant is internal
      const applicantIsInternal = !(grant.isPIExternal && grant.myRole ===
   'pi');

      if (!applicantIsInternal) {
        return { incentive: 0, points: 0 };
      }

      // Get internal team members
      const internalTeamMembers = (grant.investigators || []).filter((inv: any) =>
        inv.investigatorCategory ===
   'Internal' || inv.isInternal ===
   true
      );

      // Total internal count includes applicant
      const totalInternal = 1 + internalTeamMembers.length;

      if (totalInternal ===
   0) {
        return { incentive: 0, points: 0 };
      }

      // For equal split (default behavior when no rolePercentages)
      const totalIncentive = Number(grant.calculatedIncentiveAmount) || 0;
      const totalPoints = Number(grant.calculatedPoints) || 0;

      // Simple equal division using Math.floor
      const applicantIncentive = Math.floor(totalIncentive / totalInternal);
      const applicantPoints = Math.floor(totalPoints / totalInternal);

      return { incentive: applicantIncentive, points: applicantPoints };
    };

    const { totalGrantIncentives, totalGrantPoints } = completedGrants.reduce(
      (acc, g) => {
        const share = calculateApplicantShare(g);
        return {
          totalGrantIncentives: acc.totalGrantIncentives + share.incentive,
          totalGrantPoints: acc.totalGrantPoints + share.points
        };
      },
      { totalGrantIncentives: 0, totalGrantPoints: 0 }
    );

    setStats({
      total: contributions.length + grants.length,
      drafts: contributions.filter((c: ResearchContribution) => c.status ===
   'draft').length +
              grants.filter((g: GrantApplication) => g.status ===
   'draft').length,
      action_required: contributions.filter((c: ResearchContribution) => actionRequiredStatuses.includes(c.status)).length +
                       grants.filter((g: GrantApplication) => g.status ===
   'changes_required').length,
      in_progress: contributions.filter((c: ResearchContribution) => inProgressStatuses.includes(c.status)).length +
                   grants.filter((g: GrantApplication) => ['submitted', 'under_review', 'resubmitted'].includes(g.status)).length,
      completed: contributions.filter((c: ResearchContribution) => completedStatuses.includes(c.status)).length +
                 grants.filter((g: GrantApplication) => ['approved', 'completed'].includes(g.status)).length,
      rejected: contributions.filter((c: ResearchContribution) => c.status ===
   'rejected').length +
                grants.filter((g: GrantApplication) => g.status ===
   'rejected').length,
      totalIncentives: creditedIncentives + totalGrantIncentives,
      totalPoints: creditedPoints + totalGrantPoints,
    });
  }, [contributions, getMyContributionShare, grants]);

  const getFilteredContributions = useCallback(() => {
    if (!Array.isArray(contributions)) return [];

    let filtered = [...contributions];

    // Tab filter
    if (activeTab === 'synced') {
      filtered = filtered
        .filter(isSyncedDraft)
        .filter((c) => showOtherInstitutions || c.homeAffiliation !== 'not_affiliated');
      // Eligible first, then the ones DRD has to verify, then other institutions.
      const rank = { affiliated: 0, unknown: 1, not_affiliated: 2 } as Record<string, number>;
      filtered.sort((a, b) => (rank[a.homeAffiliation || 'unknown'] ?? 1) - (rank[b.homeAffiliation || 'unknown'] ?? 1));
    } else if (activeTab ===
   'action_required') {
      filtered = filtered.filter(c => c.status ===
   'changes_required');
    } else if (activeTab ===
   'draft') {
      filtered = filtered.filter(c => c.status ===
   'draft');
    } else if (activeTab ===
   'in_progress') {
      filtered = filtered.filter(c => ['submitted', 'under_review', 'resubmitted', 'pending_mentor_approval'].includes(c.status));
    } else if (activeTab ===
   'completed') {
      filtered = filtered.filter(c => ['approved', 'completed', 'rejected'].includes(c.status));
    }

    // Publication type filter
    if (publicationTypeFilter && publicationTypeFilter !== 'grant') {
      filtered = filtered.filter(c => c.publicationType ===
   publicationTypeFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(query) ||
        c.applicationNumber?.toLowerCase().includes(query) ||
        c.journalName?.toLowerCase().includes(query) ||
        c.conferenceName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [contributions, activeTab, publicationTypeFilter, searchQuery, showOtherInstitutions]);

  const getFilteredGrants = useCallback(() => {
    if (!Array.isArray(grants)) return [];

    let filtered = [...grants];
    if (activeTab === 'synced') return [];

    // Tab filter
    if (activeTab ===
   'action_required') {
      filtered = filtered.filter(g => g.status ===
   'changes_required');
    } else if (activeTab ===
   'draft') {
      filtered = filtered.filter(g => g.status ===
   'draft');
    } else if (activeTab ===
   'in_progress') {
      filtered = filtered.filter(g => ['submitted', 'under_review', 'resubmitted'].includes(g.status));
    } else if (activeTab ===
   'completed') {
      filtered = filtered.filter(g => ['approved', 'completed', 'rejected'].includes(g.status));
    }

    // Publication type filter
    if (publicationTypeFilter && publicationTypeFilter !== 'grant') {
      return []; // Don't show grants if filtering by other publication types
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(g =>
        g.title.toLowerCase().includes(query) ||
        g.applicationNumber?.toLowerCase().includes(query) ||
        g.agencyName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [grants, activeTab, publicationTypeFilter, searchQuery]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = await confirmDelete('Delete Draft', 'Are you sure you want to delete this draft?');
    if (!confirmed) return;

    try {
      await researchService.deleteContribution(id);
      fetchContributions();
    } catch (error: unknown) {
      logger.error('Error deleting contribution:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleSubmit = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const c = contributions.find((x) => x.id === id);
    const synced = c?.sourceType === 'auto_import';
    const confirmed = await confirmAction(
      synced ? (c?.homeAffiliation === 'affiliated' ? 'Submit for incentive' : 'Send to DRD for verification') : 'Confirm Submission',
      synced
        ? (c?.homeAffiliation === 'affiliated'
          ? 'Submit this work to DRD for incentive review?'
          : 'The sync could not confirm your affiliation with this university on this work. DRD will verify it before any incentive. Send it?')
        : 'Submit this contribution for review?',
    );
    if (!confirmed) return;

    try {
      await researchService.submitContribution(id);
      toast({ type: 'success', message: synced ? 'Sent to DRD for review.' : 'Submitted for review.' });
      fetchContributions();
    } catch (error: unknown) {
      logger.error('Error submitting contribution:', error);
      const duplicate = getDuplicateClaimError(error);
      if (duplicate) {
        // 409 DUPLICATE_CLAIM: say who already claimed this work
        toast({ type: 'warning', title: 'Already claimed', message: duplicate.message, duration: 12000 });
      } else {
        toast({ type: 'error', message: extractErrorMessage(error) });
      }
    }
  };

  const handleSubmitAllAffiliated = async () => {
    const ids = contributions.filter((c) => isSyncedDraft(c) && c.homeAffiliation === 'affiliated').map((c) => c.id);
    if (!ids.length) return;
    const confirmed = await confirmAction('Submit for incentive', `Submit all ${ids.length} affiliated synced work${ids.length === 1 ? '' : 's'} to DRD for incentive review?`);
    if (!confirmed) return;
    setBulkSubmitting(true);
    try {
      const res = await researchService.submitManyContributions(ids);
      const firstFailure = res.results.find((r) => !r.ok);
      toast({
        type: res.failed ? 'warning' : 'success',
        message: `${res.submitted} submitted for incentive${res.failed ? `, ${res.failed} not submitted${firstFailure?.message ? ` (e.g. ${firstFailure.message})` : ''}` : ''}.`,
        duration: res.failed ? 12000 : 5000,
      });
      fetchContributions();
    } catch (error: unknown) {
      logger.error('Bulk submit failed:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleResubmit = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = await confirmAction('Confirm Resubmission', 'Resubmit this contribution?');
    if (!confirmed) return;

    try {
      await researchService.resubmitContribution(id);
      fetchContributions();
    } catch (error: unknown) {
      logger.error('Error resubmitting contribution:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleGrantDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = await confirmDelete('Delete Grant Application', 'Are you sure you want to delete this grant application?');
    if (!confirmed) return;

    try {
      await researchService.deleteGrantApplication(id);
      fetchGrants();
    } catch (error: unknown) {
      logger.error('Error deleting grant:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleGrantSubmit = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = await confirmAction('Confirm Submission', 'Submit this grant application for review?');
    if (!confirmed) return;

    try {
      await researchService.submitGrantApplication(id);
      fetchGrants();
    } catch (error: unknown) {
      logger.error('Error submitting grant:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const filteredContributions = getFilteredContributions();
  const filteredGrants = getFilteredGrants();

  // ── Loading State ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-blush">
        {/* Header skeleton */}
        <div className="bg-blush-light border-b border-blush-deep/80 px-6 py-5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <div className="h-3 w-36 bg-peach/60 rounded animate-pulse mb-2" />
              <div className="h-6 w-64 bg-peach/70 rounded animate-pulse mb-1" />
              <div className="h-3.5 w-48 bg-peach/40 rounded animate-pulse" />
            </div>
            <div className="h-9 w-36 bg-peach/70 rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          {/* Stats skeleton */}
          <div className="bg-blush-light border border-blush-deep/70 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-blush-deep/60">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-peach/60 animate-pulse flex-shrink-0" />
                  <div>
                    <div className="h-6 w-10 bg-peach/70 rounded animate-pulse mb-1" />
                    <div className="h-3 w-16 bg-peach/40 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* List skeleton */}
          <div className="bg-blush-light border border-blush-deep/70 rounded-2xl overflow-hidden">
            <div className="border-b border-blush-deep/60 px-6 py-4">
              <div className="h-4 w-40 bg-peach/60 rounded animate-pulse" />
            </div>
            <div className="divide-y divide-blush-deep/50">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-peach/60 animate-pulse flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 w-3/4 bg-peach/70 rounded animate-pulse mb-2" />
                    <div className="h-3 w-1/2 bg-peach/40 rounded animate-pulse" />
                  </div>
                  <div className="h-6 w-24 rounded-full bg-peach/60 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-blush">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="bg-blush-light border-b border-blush-deep/80 shadow-[0_1px_0_rgba(245,232,220,0.6)]">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-wine/70 mb-1 font-semibold tracking-wide uppercase">
                <Layers className="w-3.5 h-3.5 text-amber" />
                Research Management
              </div>
              <h1 className="text-2xl font-bold text-charcoal tracking-tight font-serif">My Contributions</h1>
              <p className="text-sm text-charcoal/55 mt-0.5">
                Track and manage all your research paper submissions
              </p>
            </div>
            <Link
              href="/research/apply"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-wine-fg bg-wine hover:bg-wine-dark rounded-xl transition-colors shadow-sm shadow-wine/20"
            >
              <Plus className="w-4 h-4" />
              New Contribution
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Stats Bar ──────────────────────────────────────────── */}
        <div className="bg-blush-light border border-blush-deep/70 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgb(var(--brand-primary)/0.04)]">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-blush-deep/60">

            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-peach to-peach/40 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-wine" />
              </div>
              <div>
                <p className="text-xl font-bold text-charcoal tabular-nums">{stats.total}</p>
                <p className="text-xs text-charcoal/50 font-medium">Total</p>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-peach to-peach/40 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber" />
              </div>
              <div>
                <p className="text-xl font-bold text-charcoal tabular-nums">{stats.in_progress}</p>
                <p className="text-xs text-charcoal/50 font-medium">In Progress</p>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-peach to-peach/40 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-wine-dark" />
              </div>
              <div>
                <p className="text-xl font-bold text-charcoal tabular-nums">{stats.completed}</p>
                <p className="text-xs text-charcoal/50 font-medium">Completed</p>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-peach to-peach/40 flex items-center justify-center flex-shrink-0">
                <Coins className="w-4 h-4 text-amber-dark" />
              </div>
              <div>
                <p className="text-xl font-bold text-charcoal tabular-nums">₹{stats.totalIncentives.toLocaleString()}</p>
                <p className="text-xs text-charcoal/50 font-medium">Incentives</p>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-peach to-peach/40 flex items-center justify-center flex-shrink-0">
                <Award className="w-4 h-4 text-wine" />
              </div>
              <div>
                <p className="text-xl font-bold text-charcoal tabular-nums">{stats.totalPoints}</p>
                <p className="text-xs text-charcoal/50 font-medium">Points</p>
              </div>
            </div>

          </div>
        </div>

        {/* ── Main Table Card ─────────────────────────────────────── */}
        <div className="bg-blush-light border border-blush-deep/70 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgb(var(--brand-primary)/0.04)]">

          {/* Tab bar */}
          <div className="border-b border-blush-deep/60 px-2">
            <nav className="flex overflow-x-auto">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                const count = tab.key === 'all' ? stats.total
                            : tab.key === 'synced' ? contributions.filter(isSyncedDraft).length
                            : tab.key === 'action_required' ? stats.action_required
                            : tab.key === 'draft' ? stats.drafts
                            : tab.key === 'in_progress' ? stats.in_progress
                            : stats.completed + stats.rejected;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-150 ${
                      isActive
                        ? 'border-wine text-wine'
                        : 'border-transparent text-charcoal/50 hover:text-charcoal/80'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    <span className={`px-1.5 py-0.5 rounded-md text-xs font-semibold ${
                      isActive
                        ? 'bg-peach/60 text-wine'
                        : 'bg-brand-50 text-charcoal/45'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Search & Filter bar */}
          <div className="px-4 py-3 border-b border-blush-deep/50 bg-blush/60 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/35" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, journal, conference…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-blush-light border border-blush-deep/70 rounded-xl focus:ring-2 focus:ring-wine/15 focus:border-wine transition-all text-charcoal placeholder:text-charcoal/35"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/35 pointer-events-none" />
              <select
                value={publicationTypeFilter}
                onChange={(e) => setPublicationTypeFilter(e.target.value)}
                className="pl-9 pr-8 py-2 text-sm bg-blush-light border border-blush-deep/70 rounded-xl focus:ring-2 focus:ring-wine/15 focus:border-wine cursor-pointer transition-all text-charcoal appearance-none"
              >
                <option value="">All Types</option>
                {Object.entries(PUBLICATION_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-charcoal/35 pointer-events-none" />
            </div>
          </div>

          {activeTab === 'synced' && (() => {
            const synced = contributions.filter(isSyncedDraft);
            const n = (k: string) => synced.filter((c) => (c.homeAffiliation || 'unknown') === k).length;
            return (
              <div className="flex flex-col gap-3 border-b border-blush-deep/50 bg-emerald-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-charcoal/80">
                  <p className="font-semibold text-charcoal">Synced works are not submitted automatically.</p>
                  <p className="mt-0.5">
                    <span className="font-semibold text-emerald-800">{n('affiliated')} affiliated</span> with this university (eligible for incentive) ·{' '}
                    <span className="font-semibold text-amber-900">{n('unknown')} unverified</span> (DRD checks them) ·{' '}
                    <span className="font-semibold text-stone-600">{n('not_affiliated')} other institutions</span> (not eligible)
                  </p>
                  <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-charcoal/60">
                    <input type="checkbox" checked={showOtherInstitutions} onChange={(e) => setShowOtherInstitutions(e.target.checked)} className="rounded border-blush-deep text-wine focus:ring-wine/30" />
                    Show works from other institutions
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleSubmitAllAffiliated}
                  disabled={bulkSubmitting || n('affiliated') === 0}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {bulkSubmitting ? 'Submitting…' : `Submit all affiliated for incentive (${n('affiliated')})`}
                </button>
              </div>
            );
          })()}

          {/* List */}
          <div className="divide-y divide-blush-deep/50">
            {filteredContributions.length === 0 && filteredGrants.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-peach/50 flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-7 h-7 text-wine/50" />
                </div>
                <h3 className="text-base font-semibold text-charcoal mb-1">No contributions found</h3>
                <p className="text-sm text-charcoal/55 mb-6 max-w-sm mx-auto">
                  {activeTab === 'all'
                    ? "You haven't submitted any research contributions yet. Start by creating your first submission."
                    : `No ${TABS.find(t => t.key === activeTab)?.label.toLowerCase()} contributions to display.`}
                </p>
                <Link
                  href="/research/apply"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-wine text-wine-fg text-sm font-semibold rounded-xl hover:bg-wine-dark transition-colors shadow-sm shadow-wine/20"
                >
                  <Plus className="w-4 h-4" />
                  Create New Contribution
                </Link>
              </div>
            ) : (
              <>
                {/* ── Grant Applications ── */}
                {filteredGrants.map((grant) => {
                  const statusConfig = STATUS_CONFIG[grant.status] || STATUS_CONFIG.draft;
                  const StatusIcon = statusConfig.icon;
                  const pubTypeConfig = PUBLICATION_TYPE_CONFIG['grant_proposal'];
                  const PubTypeIcon = pubTypeConfig?.icon || FileText;

                  return (
                    <div key={`grant-${grant.id}`}>
                      <Link
                        href={`/research/grant/${grant.id}`}
                        className="flex items-start gap-4 px-6 py-4 hover:bg-blush/80 transition-colors group"
                      >
                        {/* Icon */}
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${pubTypeConfig.accent}18` }}
                        >
                          <PubTypeIcon className="w-5 h-5" style={{ color: pubTypeConfig.accent }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-charcoal truncate group-hover:text-wine transition-colors">
                                {grant.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                {grant.agencyName && (
                                  <span className="text-xs text-charcoal/55">{grant.agencyName}</span>
                                )}
                                {grant.submittedAmount && (
                                  <>
                                    <span className="text-charcoal/25">·</span>
                                    <span className="text-xs text-charcoal/55">₹{Number(grant.submittedAmount).toLocaleString()}</span>
                                  </>
                                )}
                                {grant.applicationNumber && (
                                  <>
                                    <span className="text-charcoal/25">·</span>
                                    <span className="text-xs font-mono text-charcoal/45">{grant.applicationNumber}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5">
                                {grant.projectType && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${pubTypeConfig.accentBg} ${pubTypeConfig.accentText}`}>
                                    {grant.projectType === 'indian' ? 'Indian Project' : 'International Project'}
                                  </span>
                                )}
                                <span className="text-xs text-charcoal/45">
                                  {new Date(grant.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </div>

                            {/* Status + Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                                {statusConfig.label}
                              </span>
                              {grant.status === 'draft' && (
                                <div className="flex items-center gap-1" onClick={e => e.preventDefault()}>
                                  <button
                                    onClick={e => handleGrantSubmit(grant.id, e)}
                                    className="p-1.5 text-wine hover:bg-peach/50 rounded-lg transition-colors"
                                    title="Submit for review"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={e => handleGrantDelete(grant.id, e)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                    title="Delete draft"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                              <ChevronRight className="w-4 h-4 text-charcoal/25 group-hover:text-wine/60 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}

                {/* ── Research Contributions ── */}
                {filteredContributions.map((contribution) => {
                  const statusConfig = STATUS_CONFIG[contribution.status] || STATUS_CONFIG.draft;
                  const StatusIcon = statusConfig.icon;
                  const pubTypeConfig = PUBLICATION_TYPE_CONFIG[contribution.publicationType];
                  const PubTypeIcon = pubTypeConfig?.icon || FileText;
                  const contributionShare = getMyContributionShare(contribution);

                  return (
                    <div
                      key={contribution.id}
                      className={isSyncedDraft(contribution)
                        ? contribution.homeAffiliation === 'affiliated'
                          ? 'border-l-4 border-emerald-500 bg-emerald-50/50'
                          : contribution.homeAffiliation === 'not_affiliated'
                            ? 'border-l-4 border-stone-200 opacity-70'
                            : 'border-l-4 border-amber-300 bg-amber-50/30'
                        : undefined}
                    >
                      <Link
                        href={`/research/contribution/${contribution.id}`}
                        className="flex items-start gap-4 px-6 py-4 hover:bg-blush/80 transition-colors group"
                      >
                        {/* Icon */}
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: pubTypeConfig ? `${pubTypeConfig.accent}18` : `${W.wine}18` }}
                        >
                          <PubTypeIcon
                            className="w-5 h-5"
                            style={{ color: pubTypeConfig?.accent || W.wine }}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-charcoal truncate group-hover:text-wine transition-colors">
                                {contribution.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                <span className="text-xs font-medium text-charcoal/55">
                                  {contribution.applicationNumber || 'Draft'}
                                </span>
                                <span className="text-charcoal/25">·</span>
                                <span className="text-xs text-charcoal/55">{pubTypeConfig?.label || contribution.publicationType}</span>
                                {contribution.journalName && (
                                  <>
                                    <span className="text-charcoal/25">·</span>
                                    <span className="text-xs text-charcoal/45 truncate max-w-[160px]">{contribution.journalName}</span>
                                  </>
                                )}
                                {contribution.conferenceName && (
                                  <>
                                    <span className="text-charcoal/25">·</span>
                                    <span className="text-xs text-charcoal/45 truncate max-w-[160px]">{contribution.conferenceName}</span>
                                  </>
                                )}
                              </div>

                              {contribution.sourceType === 'auto_import' && contribution.homeAffiliation && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  <AffiliationBadge c={contribution} />
                                  {contribution.homeAffiliationDetail && (
                                    <span className="max-w-[420px] truncate text-[11px] text-charcoal/50" title={contribution.homeAffiliationDetail}>
                                      {contribution.homeAffiliationDetail}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Incentives row */}
                              {(contributionShare.estimatedIncentive > 0 || contributionShare.estimatedPoints > 0) && (
                                <div className="flex items-center gap-2 mt-1.5">
                                  {['approved', 'completed'].includes(contribution.status) && contributionShare.creditedIncentive > 0 ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-peach/55 text-wine-dark">
                                        <Coins className="w-3 h-3" />
                                        ₹{contributionShare.creditedIncentive.toLocaleString()}
                                      </span>
                                      {contributionShare.creditedPoints > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-peach/40 text-amber-dark">
                                          <Award className="w-3 h-3" />
                                          {contributionShare.creditedPoints} pts
                                        </span>
                                      )}
                                      <span className="text-xs text-wine font-medium">✓ Credited</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-peach/45 text-wine">
                                        <Coins className="w-3 h-3" />
                                        ₹{contributionShare.estimatedIncentive.toLocaleString()}
                                      </span>
                                      {contributionShare.estimatedPoints > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-peach/35 text-amber-dark">
                                          <Award className="w-3 h-3" />
                                          {contributionShare.estimatedPoints} pts
                                        </span>
                                      )}
                                      <span className="text-xs text-charcoal/45">Estimated</span>
                                    </>
                                  )}
                                </div>
                              )}

                              <p className="text-xs text-charcoal/45 mt-1">
                                {new Date(contribution.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </p>
                            </div>

                            {/* Status + Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                                {statusConfig.label}
                              </span>

                              {contribution.status === 'draft' && (
                                <div className="flex items-center gap-1" onClick={e => e.preventDefault()}>
                                  {contribution.sourceType === 'auto_import' ? (
                                    contribution.homeAffiliation === 'not_affiliated' ? (
                                      <span className="px-2 py-1 text-[11px] font-medium text-stone-500" title={contribution.homeAffiliationDetail || 'Another institution'}>
                                        Not eligible
                                      </span>
                                    ) : contribution.homeAffiliation === 'affiliated' ? (
                                      <button
                                        onClick={e => handleSubmit(contribution.id, e)}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                                      >
                                        <Send className="w-3.5 h-3.5" aria-hidden="true" /> Submit for incentive
                                      </button>
                                    ) : (
                                      <button
                                        onClick={e => handleSubmit(contribution.id, e)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                                      >
                                        <ShieldQuestion className="w-3.5 h-3.5" aria-hidden="true" /> Send to DRD to verify
                                      </button>
                                    )
                                  ) : (
                                  <button
                                    onClick={e => handleSubmit(contribution.id, e)}
                                    className="p-1.5 text-wine hover:bg-peach/50 rounded-lg transition-colors"
                                    title="Submit for review"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                  )}
                                  <button
                                    onClick={e => handleDelete(contribution.id, e)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                    title="Delete draft"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {contribution.status === 'changes_required' && (
                                <button
                                  onClick={e => handleResubmit(contribution.id, e)}
                                  className="p-1.5 text-amber hover:bg-peach/50 rounded-lg transition-colors"
                                  title="Resubmit"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <ChevronRight className="w-4 h-4 text-charcoal/25 group-hover:text-wine/60 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
