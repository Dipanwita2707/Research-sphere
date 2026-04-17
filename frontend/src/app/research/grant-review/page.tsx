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
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  under_review: { label: 'Under Review', icon: Eye, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  changes_required: { label: 'Changes Required', icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  resubmitted: { label: 'Resubmitted', icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-100' },
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
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-56 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-80 bg-gray-100 rounded animate-pulse" />
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
              <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
        {/* List skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="h-5 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                  <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mb-3" />
                  <div className="flex gap-2">
                    <div className="h-6 w-24 bg-orange-100 rounded-full animate-pulse" />
                    <div className="h-6 w-20 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Link href="/dashboard" className="text-orange-600 hover:text-orange-700 font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">Grant Review Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">Review and manage research grant applications</p>
            </div>
            <button
              onClick={fetchGrants}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                </div>
                <DollarSign className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-blue-200 dark:border-blue-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Submitted</p>
                  <p className="text-2xl font-bold text-blue-700">{stats.submitted}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-yellow-200 dark:border-yellow-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600">Under Review</p>
                  <p className="text-2xl font-bold text-yellow-700">{stats.underReview}</p>
                </div>
                <Eye className="h-8 w-8 text-yellow-400" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-orange-200 dark:border-orange-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600">Changes Req.</p>
                  <p className="text-2xl font-bold text-orange-700">{stats.changesRequired}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-400" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-green-200 dark:border-green-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Approved</p>
                  <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search grants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Project Types</option>
              <option value="indian">Indian</option>
              <option value="international">International</option>
            </select>
            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-end">
              Showing {filteredGrants.length} of {grants.length} grants
            </div>
          </div>
        </div>

        {/* Grants List */}
        <div className="space-y-4">
          {filteredGrants.length ===
   0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-sm">
              <FileText className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No grant applications found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || statusFilter !== 'all' || projectTypeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No pending grant applications at the moment'}
              </p>
            </div>
          ) : (
            filteredGrants.map((grant) => {
              const statusConfig = STATUS_CONFIG[grant.status];
              const StatusIcon = statusConfig?.icon || FileText;

              return (
                <div key={grant.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{grant.title}</h3>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig?.bgColor} ${statusConfig?.color}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusConfig?.label}
                        </span>
                        {grant.projectType ===
   'international' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            <Globe className="h-3.5 w-3.5" />
                            International
                          </span>
                        )}
                      </div>
                      {grant.applicationNumber && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Application #{grant.applicationNumber}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Agency</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{grant.agencyName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Amount</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(grant.submittedAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Investigators</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {grant.totalInvestigators}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Submitted</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(grant.submittedAt)}
                      </p>
                    </div>
                  </div>

                  {grant.projectType ===
   'international' && grant.consortiumOrganizations && grant.consortiumOrganizations.length > 0 && (
                    <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs font-medium text-purple-900 mb-2">Consortium Organizations:</p>
                      <div className="flex flex-wrap gap-2">
                        {grant.consortiumOrganizations.map((org, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 bg-white rounded text-purple-700 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {org.organizationName} ({org.country})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link
                      href={`/research/grant/${grant.id}`}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Link>

                    {grant.status ===
   'submitted' || grant.status ===
   'resubmitted' ? (
                      <button
                        onClick={() => handleStartReview(grant.id)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        Start Review
                      </button>
                    ) : null}

                    {grant.status ===
   'under_review' ? (
                      <>
                        <button
                          onClick={() => handleRecommend(grant.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Check className="h-4 w-4" />
                          Recommend
                        </button>
                        <button
                          onClick={() => handleRequestChanges(grant.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Request Changes
                        </button>
                        <button
                          onClick={() => handleApprove(grant.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(grant.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </button>
                      </>
                    ) : null}

                    {grant.status ===
   'approved' ? (
                      <button
                        onClick={() => handleMarkCompleted(grant.id)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark Completed
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
