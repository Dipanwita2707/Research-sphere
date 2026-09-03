'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Search,
  Filter,
  Eye,
  Check,
  X,
  MessageSquare,
  DollarSign,
  Building,
  Hash,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  User,
  Send,
  Calendar,
  Users,
  Globe,
  MapPin
} from 'lucide-react';
import { researchService, GrantApplication } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  submitted: { label: 'Submitted', icon: Clock, color: 'text-[#7d1a34]', bgColor: 'bg-[#fbe2e8]' },
  under_review: { label: 'Under Review', icon: Eye, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  changes_required: { label: 'Changes Required', icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  resubmitted: { label: 'Resubmitted', icon: RefreshCw, color: 'text-[#7d1a34]', bgColor: 'bg-[#fbe2e8]' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-700', bgColor: 'bg-green-200' },
};

type StatusFilter = 'all' | 'submitted' | 'under_review' | 'changes_required' | 'resubmitted' | 'approved';

export default function GrantReviewDashboard() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { confirmAction } = useConfirm();
  const [grants, setGrants] = useState<GrantApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectTypeFilter, setProjectTypeFilter] = useState('all');

  useEffect(() => {
    fetchGrants();
  }, []);

  const fetchGrants = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await researchService.getPendingGrantReviews();
      setGrants(response.data || []);
    } catch (error: unknown) {
      logger.error('Error fetching grants:', error);
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = async (grantId: string) => {
    try {
      await researchService.startGrantReview(grantId);
      fetchGrants();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleRecommend = async (grantId: string) => {
    const comments = prompt('Enter comments (optional):');
    try {
      await researchService.recommendGrant(grantId, { comments: comments || undefined });
      fetchGrants();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleRequestChanges = async (grantId: string) => {
    const comments = prompt('Enter required changes:');
    if (!comments) return;
    
    try {
      await researchService.requestGrantChanges(grantId, { comments });
      fetchGrants();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleApprove = async (grantId: string) => {
    const confirmed = await confirmAction('Approve Grant', 'Are you sure you want to approve this grant application?');
    if (!confirmed) return;
    
    const comments = prompt('Enter approval comments (optional):');
    try {
      await researchService.approveGrant(grantId, { comments: comments || undefined });
      fetchGrants();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleReject = async (grantId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    try {
      await researchService.rejectGrant(grantId, { reason });
      fetchGrants();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleMarkCompleted = async (grantId: string) => {
    const confirmed = await confirmAction('Mark Completed', 'Mark this grant as completed?');
    if (!confirmed) return;
    
    try {
      await researchService.markGrantCompleted(grantId);
      fetchGrants();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  // Filter grants
  const filteredGrants = grants.filter(grant => {
    if (statusFilter !== 'all' && grant.status !== statusFilter) return false;
    if (projectTypeFilter !== 'all' && grant.projectType !== projectTypeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        grant.title?.toLowerCase().includes(query) ||
        grant.agencyName?.toLowerCase().includes(query) ||
        grant.applicationNumber?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Calculate stats
  const stats = {
    total: grants.length,
    submitted: grants.filter(g => g.status ===
   'submitted').length,
    underReview: grants.filter(g => g.status ===
   'under_review').length,
    changesRequired: grants.filter(g => g.status ===
   'changes_required').length,
    approved: grants.filter(g => g.status ===
   'approved').length,
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5">
          <div className="max-w-7xl mx-auto">
            <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
            <div className="h-6 w-60 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-1" />
            <div className="h-3.5 w-48 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-slate-200 dark:divide-slate-800">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="p-5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse flex-shrink-0" />
                  <div><div className="h-6 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-1" /><div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
            {[1,2,3,4].map(i => (
              <div key={i} className="px-6 py-5 flex items-start gap-4">
                <div className="flex-1"><div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" /><div className="h-3 w-1/3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></div>
                <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Access Denied</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{error}</p>
          <Link href="/dashboard" className="text-sm font-medium text-[#7d1a34] dark:text-[#c8973f] hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium tracking-wide uppercase">
              <DollarSign className="w-3.5 h-3.5" />
              Research Management
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Grant Review Dashboard</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Review and manage research grant applications</p>
          </div>
          <button
            onClick={fetchGrants}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors mt-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Stats Bar ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-slate-200 dark:divide-slate-800">
            {[
              { label: 'Total',          value: stats.total,          icon: DollarSign,  bg: 'bg-slate-50 dark:bg-slate-800',        accent: 'text-slate-600 dark:text-slate-400' },
              { label: 'Submitted',      value: stats.submitted,      icon: Send,        bg: 'bg-[#fdf5ec] dark:bg-blue-950/50',       accent: 'text-[#7d1a34] dark:text-[#c8973f]' },
              { label: 'Under Review',   value: stats.underReview,    icon: Eye,         bg: 'bg-amber-50 dark:bg-amber-950/50',     accent: 'text-amber-600 dark:text-amber-400' },
              { label: 'Changes Req.',   value: stats.changesRequired, icon: AlertCircle, bg: 'bg-orange-50 dark:bg-orange-950/50',   accent: 'text-orange-600 dark:text-orange-400' },
              { label: 'Approved',       value: stats.approved,       icon: CheckCircle, bg: 'bg-green-50 dark:bg-green-950/50',     accent: 'text-green-600 dark:text-green-400' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="p-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${stat.accent}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{stat.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Filters Bar ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search grants…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#7d1a34]/20 focus:border-[#7d1a34] transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#7d1a34]/20 focus:border-[#7d1a34] text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="changes_required">Changes Required</option>
              <option value="resubmitted">Resubmitted</option>
              <option value="approved">Approved</option>
            </select>
            <select
              value={projectTypeFilter}
              onChange={(e) => setProjectTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#7d1a34]/20 focus:border-[#7d1a34] text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Project Types</option>
              <option value="indian">Indian</option>
              <option value="international">International</option>
            </select>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{filteredGrants.length} of {grants.length} grants</span>
          </div>
        </div>

        {/* ── Grants List ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {filteredGrants.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">No grant applications found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchQuery || statusFilter !== 'all' || projectTypeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No pending grant applications at the moment'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredGrants.map((grant) => {
                const statusConfig = STATUS_CONFIG[grant.status];
                const StatusIcon = statusConfig?.icon || FileText;
                const dot: Record<string, string> = {
                  submitted: 'bg-[#7d1a34]', under_review: 'bg-amber-500', changes_required: 'bg-orange-500',
                  resubmitted: 'bg-[#7d1a34]', approved: 'bg-green-500', rejected: 'bg-red-500', completed: 'bg-emerald-500',
                };
                const badge: Record<string, string> = {
                  submitted: 'bg-[#fdf5ec] text-[#7d1a34] dark:bg-blue-950/60 dark:text-[#c8973f]',
                  under_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
                  changes_required: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
                  resubmitted: 'bg-[#fdf5ec] text-[#7d1a34] dark:bg-blue-950/60 dark:text-[#c8973f]',
                  approved: 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300',
                  rejected: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
                  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
                };

                return (
                  <div key={grant.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{grant.title}</h3>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge[grant.status] || 'bg-slate-100 text-slate-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dot[grant.status] || 'bg-slate-400'}`} />
                            {statusConfig?.label}
                          </span>
                          {grant.projectType === 'international' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                              <Globe className="w-3 h-3" />International
                            </span>
                          )}
                        </div>
                        {grant.applicationNumber && (
                          <p className="text-xs font-mono text-slate-400 dark:text-slate-500">{grant.applicationNumber}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mb-4">
                      <div><p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Agency</p><p className="text-xs font-medium text-slate-700 dark:text-slate-300">{grant.agencyName || '—'}</p></div>
                      <div><p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Amount</p><p className="text-xs font-medium text-slate-700 dark:text-slate-300">{formatCurrency(grant.submittedAmount)}</p></div>
                      <div><p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Investigators</p><p className="text-xs font-medium text-slate-700 dark:text-slate-300">{grant.totalInvestigators}</p></div>
                      <div><p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Submitted</p><p className="text-xs font-medium text-slate-700 dark:text-slate-300">{formatDate(grant.submittedAt)}</p></div>
                    </div>

                    {grant.projectType === 'international' && grant.consortiumOrganizations && grant.consortiumOrganizations.length > 0 && (
                      <div className="mb-3 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-100 dark:border-violet-900">
                        <p className="text-xs font-medium text-violet-800 dark:text-violet-300 mb-1.5">Consortium Organizations:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {grant.consortiumOrganizations.map((org, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 bg-white dark:bg-slate-800 rounded text-violet-700 dark:text-violet-300 flex items-center gap-1 border border-violet-100 dark:border-violet-900">
                              <MapPin className="h-3 w-3" />{org.organizationName} ({org.country})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <Link href={`/research/grant/${grant.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Eye className="h-3.5 w-3.5" />View Details
                      </Link>
                      {(grant.status === 'submitted' || grant.status === 'resubmitted') && (
                        <button onClick={() => handleStartReview(grant.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7d1a34] rounded-lg hover:bg-[#5e1024] transition-colors">
                          <Eye className="h-3.5 w-3.5" />Start Review
                        </button>
                      )}
                      {grant.status === 'under_review' && (
                        <>
                          <button onClick={() => handleRecommend(grant.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                            <Check className="h-3.5 w-3.5" />Recommend
                          </button>
                          <button onClick={() => handleRequestChanges(grant.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors">
                            <MessageSquare className="h-3.5 w-3.5" />Request Changes
                          </button>
                          <button onClick={() => handleApprove(grant.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors">
                            <CheckCircle className="h-3.5 w-3.5" />Approve
                          </button>
                          <button onClick={() => handleReject(grant.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                            <X className="h-3.5 w-3.5" />Reject
                          </button>
                        </>
                      )}
                      {grant.status === 'approved' && (
                        <button onClick={() => handleMarkCompleted(grant.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                          <CheckCircle className="h-3.5 w-3.5" />Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
