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
  BookOpen,
  Presentation,
  DollarSign,
  Building,
  Hash,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  User,
  Send,
  Edit3,
  Award,
  Shield,
  Users,
  Calendar,
  Sparkles
} from 'lucide-react';
import { researchService, ResearchContribution, ResearchPublicationType } from '@/features/research-management/services/research.service';
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
};

const PUBLICATION_TYPE_CONFIG: Record<ResearchPublicationType, { label: string; icon: React.ElementType; color: string }> = {
  research_paper: { label: 'Research Paper', icon: FileText, color: 'bg-blue-500' },
  book: { label: 'Book', icon: BookOpen, color: 'bg-green-500' },
  book_chapter: { label: 'Book Chapter', icon: BookOpen, color: 'bg-green-400' },
  conference_paper: { label: 'Conference Paper', icon: Presentation, color: 'bg-purple-500' },
  grant_proposal: { label: 'Grant', icon: DollarSign, color: 'bg-orange-500' },
};

type StatusFilter = 'all' | 'submitted' | 'under_review' | 'changes_required' | 'resubmitted' | 'approved';

export default function DrdResearchDashboard() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { confirmDelete, confirmAction } = useConfirm();
  const [contributions, setContributions] = useState<ResearchContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [publicationTypeFilter, setPublicationTypeFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyMyReviews, setShowOnlyMyReviews] = useState(false);
  const [myReviewFilter, setMyReviewFilter] = useState<'all' | 'approved' | 'rejected' | 'recommended'>('all');

  useEffect(() => {
    fetchData();
    fetchSchools();
  }, []);

  useEffect(() => {
    fetchData();
  }, [statusFilter, publicationTypeFilter, schoolFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (publicationTypeFilter) {
        params.publicationType = publicationTypeFilter;
      }
      if (schoolFilter) {
        params.schoolId = schoolFilter;
      }
      
      const response = await researchService.getPendingReviews(params);
      setContributions(response.data?.contributions || []);
      setStats(response.data?.stats || {});
      setUserPermissions(response.data?.userPermissions || {});
    } catch (error: unknown) {
      logger.error('Error fetching pending reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      const response = await researchService.getSchoolsForFilter();
      setSchools(response.data || []);
    } catch (error: unknown) {
      logger.error('Error fetching schools:', error);
    }
  };

  const handleStartReview = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await researchService.startReview(id);
      fetchData();
    } catch (error: unknown) {
      logger.error('Error starting review:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleApprove = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const confirmed = await confirmAction('Confirm Approval', 'Approve this research contribution? Incentives will be credited to all authors.');
    if (!confirmed) return;
    
    try {
      await researchService.approveContribution(id, { comments: 'Approved' });
      fetchData();
    } catch (error: unknown) {
      logger.error('Error approving contribution:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const filteredContributions = contributions.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(query) ||
      c.applicationNumber?.toLowerCase().includes(query) ||
      c.applicantUser?.employeeDetails?.displayName?.toLowerCase().includes(query)
    );
  }).filter(c => {
    // Filter by "My Reviews" if enabled
    if (showOnlyMyReviews && user?.id) {
      const userHasReviewed = (c as any).reviews?.some((review: any) => review.reviewerId === user.id);
      if (!userHasReviewed) return false;
      
      // Apply my review decision filter
      if (myReviewFilter !== 'all') {
        const userReview = (c as any).reviews?.find((review: any) => review.reviewerId === user.id);
        if (myReviewFilter === 'approved' && userReview?.decision !== 'approved') return false;
        if (myReviewFilter === 'rejected' && userReview?.decision !== 'rejected') return false;
        if (myReviewFilter === 'recommended' && userReview?.decision !== 'recommended') return false;
      }
      
      return true;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Hero Header with Gradient */}
      <div className="relative overflow-hidden bg-sgt-gradient rounded-3xl p-8 text-white shadow-sgt-xl">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
        </div>
        
        {/* Floating elements */}
        <div className="absolute top-8 right-16 w-3 h-3 bg-sgt-50 rounded-full animate-float opacity-60"></div>
        <div className="absolute bottom-16 right-32 w-2 h-2 bg-sgt-100 rounded-full animate-float opacity-40" style={{animationDelay: '0.5s'}}></div>
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold">Research Review Dashboard</h1>
                <p className="text-sgt-100 text-lg mt-1">Review and approve research contributions</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl transition-all duration-200 border border-white/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="font-medium">Refresh</span>
              </button>
            </div>
          </div>

          {/* Workflow Progress */}
          <div className="mt-8 bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
            <h3 className="text-sm font-semibold text-sgt-100 mb-4 uppercase tracking-wider">Research Review Pipeline</h3>
            <div className="flex items-center justify-between overflow-x-auto">
              {[
                { icon: <Send size={16} />, label: 'Submitted', count: stats?.submitted || 0 },
                { icon: <Eye size={16} />, label: 'Under Review', count: stats?.underReview || 0 },
                { icon: <MessageSquare size={16} />, label: 'Changes Required', count: stats?.changesRequired || 0 },
                { icon: <RefreshCw size={16} />, label: 'Resubmitted', count: stats?.resubmitted || 0 },
                { icon: <ChevronRight size={16} />, label: 'Recommended', count: stats?.recommended || 0 },
                { icon: <CheckCircle size={16} />, label: 'Approved', count: stats?.approved || 0 },
              ].map((step, index, arr) => (
                <React.Fragment key={step.label}>
                  <div className="flex flex-col items-center min-w-[100px] group">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-all">
                      {step.icon}
                    </div>
                    <span className="text-xs mt-2 font-medium text-white/80">{step.label}</span>
                    {step.count > 0 && (
                      <span className="mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">{step.count}</span>
                    )}
                  </div>
                  {index < arr.length - 1 && (
                    <div className="flex-1 h-0.5 bg-white/20 mx-2 min-w-[30px]" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* User Info Bar */}
      {user && (
        <div className="bg-gradient-to-r from-sgt-50 to-white rounded-2xl p-4 shadow-sm border border-sgt-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sgt-gradient rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.employee?.displayName || user.student?.displayName || user.email}</p>
              <p className="text-xs text-gray-500">
                Role: {user.role?.name || 'N/A'} • UID: {user.uid}
                {userPermissions?.assignedSchoolIds?.length > 0 && (
                  <span className="ml-2 text-blue-600">• Assigned to {userPermissions.assignedSchoolIds.length} school(s)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* User Review Statistics */}
            <div className="flex items-center gap-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg px-4 py-2 border border-blue-100">
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">
                  {contributions.filter((c: any) => 
                    c.reviews?.some((r: any) => r.reviewerId === user.id)
                  ).length}
                </div>
                <div className="text-xs text-gray-600">You Reviewed</div>
              </div>
              <div className="w-px h-8 bg-blue-200"></div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600">
                  {contributions.filter((c: any) => 
                    c.reviews?.some((r: any) => r.reviewerId === user.id && r.decision === 'recommended')
                  ).length}
                </div>
                <div className="text-xs text-gray-600">Recommended</div>
              </div>
              <div className="w-px h-8 bg-purple-200"></div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  {contributions.filter((c: any) => 
                    c.reviews?.some((r: any) => r.reviewerId === user.id && r.decision === 'approved')
                  ).length}
                </div>
                <div className="text-xs text-gray-600">Approved</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {userPermissions?.canApprove && (
                <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Can Approve
                </span>
              )}
              {userPermissions?.canReview && (
                <span className="px-3 py-1.5 bg-sgt-100 text-sgt-700 rounded-lg text-sm font-medium">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Can Review
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Filter className="w-5 h-5 mr-2 text-sgt-600" />
            Filters & Search
          </h2>
          {/* My Reviews Toggle */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyMyReviews}
                onChange={(e) => setShowOnlyMyReviews(e.target.checked)}
                className="w-4 h-4 text-sgt-600 border-gray-300 rounded focus:ring-sgt-500"
              />
              <span className="text-sm font-medium text-gray-700">Show only my reviews</span>
            </label>
            
            {/* My Review Decision Filter - Only show when "my reviews" is enabled */}
            {showOnlyMyReviews && (
              <select
                value={myReviewFilter}
                onChange={(e) => setMyReviewFilter(e.target.value as 'all' | 'approved' | 'rejected' | 'recommended')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500"
              >
                <option value="all">All My Reviews</option>
                <option value="approved">I Approved</option>
                <option value="recommended">I Recommended</option>
                <option value="rejected">I Rejected</option>
              </select>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, app number, applicant..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
              />
            </div>
          </div>
          
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="changes_required">Changes Required</option>
              <option value="resubmitted">Resubmitted</option>
              <option value="approved">Approved</option>
            </select>
          </div>
          
          {/* Publication Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Publication Type</label>
            <select
              value={publicationTypeFilter}
              onChange={(e) => setPublicationTypeFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
            >
              <option value="">All Types</option>
              {Object.entries(PUBLICATION_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* School Filter - Full Width */}
        {schools.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">School/Faculty</label>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
            >
              <option value="">All Schools</option>
              {schools.map(school => (
                <option key={school.id} value={school.id}>
                  {school.shortName || school.facultyName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Contributions List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Research Contributions</h2>
            <p className="text-sm text-gray-500 mt-0.5">{filteredContributions.length} items found</p>
          </div>
          {filteredContributions.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <TrendingUp className="w-4 h-4" />
              <span>Showing latest submissions</span>
            </div>
          )}
        </div>
        
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sgt-600 mb-4"></div>
              <p className="text-gray-500">Loading contributions...</p>
            </div>
          ) : filteredContributions.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No contributions found</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all' || publicationTypeFilter || schoolFilter
                  ? 'Try adjusting your filters to see more results'
                  : 'There are no research contributions awaiting review'}
              </p>
            </div>
          ) : (
            filteredContributions.map((contribution, index) => {
              const statusConfig = STATUS_CONFIG[contribution.status] || STATUS_CONFIG.submitted;
              const StatusIcon = statusConfig.icon;
              const pubTypeConfig = PUBLICATION_TYPE_CONFIG[contribution.publicationType];
              const PubTypeIcon = pubTypeConfig?.icon || FileText;
              const isRecommended = (contribution as any).awaitingFinalApproval;
              
              // Check if current user has reviewed this
              const userHasReviewed = user?.id && (contribution as any).reviews?.some(
                (review: any) => review.reviewerId === user.id
              );
              
              // Get user's review decision if exists
              const userReview = user?.id && (contribution as any).reviews?.find(
                (review: any) => review.reviewerId === user.id
              );
              
              // Determine review page URL based on publication type
              const isGrant = contribution.publicationType === 'grant_proposal';
              const reviewUrl = isGrant 
                ? `/drd/research/grant-review/${contribution.id}`
                : `/drd/research/review/${contribution.id}`;
              
              return (
                <Link
                  key={contribution.id}
                  href={reviewUrl}
                  className="block p-6 hover:bg-gray-50 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Icon */}
                      <div className={`w-12 h-12 ${pubTypeConfig?.color || 'bg-gray-500'} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <PubTypeIcon className="w-6 h-6 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 group-hover:text-sgt-600 transition-colors line-clamp-2">
                              {contribution.title}
                            </h3>
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500 mt-2">
                              <span className="flex items-center font-medium">
                                <Hash className="w-3.5 h-3.5 mr-1" />
                                {contribution.applicationNumber}
                              </span>
                              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                              <span className="flex items-center">
                                {pubTypeConfig?.label || contribution.publicationType}
                              </span>
                              {contribution.school && (
                                <>
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <span className="flex items-center">
                                    <Building className="w-3.5 h-3.5 mr-1" />
                                    {contribution.school.shortName || contribution.school.facultyName}
                                  </span>
                                </>
                              )}
                            </div>
                            
                            {/* Applicant Info */}
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1.5">
                              <Users className="w-3.5 h-3.5" />
                              <span>
                                {contribution.applicantUser?.employeeDetails?.displayName || 
                                 contribution.applicantUser?.email || 'Unknown'}
                              </span>
                              {contribution.submittedAt && (
                                <>
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{new Date(contribution.submittedAt).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                            
                            {/* Incentive Preview */}
                            {contribution.calculatedIncentiveAmount && (
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className="px-2 py-1 bg-green-50 text-green-700 rounded-lg font-medium">
                                  ₹{contribution.calculatedIncentiveAmount.toLocaleString()}
                                </span>
                                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg font-medium">
                                  {contribution.calculatedPoints} points
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right Side: Status & Actions */}
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      {/* Status Badge */}
                      <div className="flex flex-col items-end gap-2">
                        <div className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          <StatusIcon className="w-4 h-4 mr-1.5" />
                          {statusConfig.label}
                        </div>
                        
                        {/* User Review Badge */}
                        {userHasReviewed && (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg font-medium">
                              <CheckCircle className="w-3 h-3 inline mr-1" />
                              {userReview?.decision === 'approved' ? 'You approved' : 'You reviewed'}
                            </span>
                            {userReview?.decision === 'recommended' && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg font-medium">
                                Recommended
                              </span>
                            )}
                            {userReview?.decision === 'approved' && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg font-medium">
                                Approved
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Recommended Badge */}
                        {isRecommended && !userHasReviewed && (
                          <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg font-medium">
                            ✓ Recommended
                          </span>
                        )}
                      </div>
                      
                      {/* Quick Actions */}
                      {contribution.status === 'submitted' && userPermissions?.canReview && (
                        <button
                          onClick={(e) => handleStartReview(contribution.id, e)}
                          className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-all shadow-sm"
                        >
                          <Eye className="w-4 h-4 inline mr-1.5" />
                          Start Review
                        </button>
                      )}
                      
                      {isRecommended && userPermissions?.canApprove && (
                        <button
                          onClick={(e) => handleApprove(contribution.id, e)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-all shadow-sm flex items-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-1.5" />
                          Final Approval
                        </button>
                      )}
                      
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-sgt-600 transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
