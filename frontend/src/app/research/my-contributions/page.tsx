'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Loader2
} from 'lucide-react';
import { researchService, ResearchContribution, ResearchPublicationType, GrantApplication } from '@/features/research-management/services/research.service';
import { grantPolicyService, GrantIncentivePolicy } from '@/features/research-management/services/grantPolicy.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

type TabType = 'all' | 'action_required' | 'draft' | 'in_progress' | 'completed';

const TABS: { key: TabType; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'all', label: 'All', icon: FolderOpen, color: 'text-gray-500' },
  { key: 'action_required', label: 'Action Required', icon: AlertCircle, color: 'text-amber-500' },
  { key: 'draft', label: 'Drafts', icon: Edit, color: 'text-gray-500' },
  { key: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  { key: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  draft: { label: 'Draft', icon: Edit, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  submitted: { label: 'Submitted', icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  pending_mentor_approval: { label: 'Pending Mentor', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  under_review: { label: 'Under Review', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  changes_required: { label: 'Changes Required', icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  resubmitted: { label: 'Resubmitted', icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
};

const PUBLICATION_TYPE_CONFIG: Record<ResearchPublicationType, { label: string; icon: React.ElementType; color: string; gradient: string }> = {
  research_paper: { label: 'Research Paper', icon: FileText, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' },
  book: { label: 'Book', icon: BookOpen, color: 'bg-green-500', gradient: 'from-green-500 to-green-600' },
  book_chapter: { label: 'Book Chapter', icon: BookOpen, color: 'bg-emerald-500', gradient: 'from-emerald-500 to-emerald-600' },
  conference_paper: { label: 'Conference Paper', icon: Presentation, color: 'bg-purple-500', gradient: 'from-purple-500 to-purple-600' },
  grant_proposal: { label: 'Grant', icon: DollarSign, color: 'bg-orange-500', gradient: 'from-orange-500 to-orange-600' },
};

export default function MyContributionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirmDelete, confirmAction } = useConfirm();
  const [contributions, setContributions] = useState<ResearchContribution[]>([]);
  const [grants, setGrants] = useState<GrantApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
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
      
      // Sort by createdAt in descending order
      const sortedData = [...data].sort((a: GrantApplication, b: GrantApplication) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setGrants(sortedData);
      return sortedData;
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
      
      // Sort by createdAt in descending order (newest first)
      const sortedData = [...data].sort((a: ResearchContribution, b: ResearchContribution) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setContributions(sortedData);
      return sortedData;
    } catch (error: unknown) {
      logger.error('Error fetching contributions:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

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
      sum + (Number(c.incentiveAmount) || 0), 0
    );
    
    const creditedPoints = completedContribs.reduce((sum: number, c: ResearchContribution) => 
      sum + (Number(c.pointsAwarded) || 0), 0
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
      const applicantIsInternal = !(grant.isPIExternal && grant.myRole === 'pi');
      
      if (!applicantIsInternal) {
        return { incentive: 0, points: 0 };
      }
      
      // Get internal team members
      const internalTeamMembers = (grant.investigators || []).filter((inv: any) => 
        inv.investigatorCategory === 'Internal' || inv.isInternal === true
      );
      
      // Total internal count includes applicant
      const totalInternal = 1 + internalTeamMembers.length;
      
      if (totalInternal === 0) {
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
      drafts: contributions.filter((c: ResearchContribution) => c.status === 'draft').length + 
              grants.filter((g: GrantApplication) => g.status === 'draft').length,
      action_required: contributions.filter((c: ResearchContribution) => actionRequiredStatuses.includes(c.status)).length +
                       grants.filter((g: GrantApplication) => g.status === 'changes_required').length,
      in_progress: contributions.filter((c: ResearchContribution) => inProgressStatuses.includes(c.status)).length +
                   grants.filter((g: GrantApplication) => ['submitted', 'under_review', 'resubmitted'].includes(g.status)).length,
      completed: contributions.filter((c: ResearchContribution) => completedStatuses.includes(c.status)).length +
                 grants.filter((g: GrantApplication) => ['approved', 'completed'].includes(g.status)).length,
      rejected: contributions.filter((c: ResearchContribution) => c.status === 'rejected').length +
                grants.filter((g: GrantApplication) => g.status === 'rejected').length,
      totalIncentives: creditedIncentives + totalGrantIncentives,
      totalPoints: creditedPoints + totalGrantPoints,
    });
  }, [contributions, grants]);

  const getFilteredContributions = useCallback(() => {
    if (!Array.isArray(contributions)) return [];
    
    let filtered = [...contributions];
    
    // Tab filter
    if (activeTab === 'action_required') {
      filtered = filtered.filter(c => c.status === 'changes_required');
    } else if (activeTab === 'draft') {
      filtered = filtered.filter(c => c.status === 'draft');
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(c => ['submitted', 'under_review', 'resubmitted', 'pending_mentor_approval'].includes(c.status));
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(c => ['approved', 'completed', 'rejected'].includes(c.status));
    }
    
    // Publication type filter
    if (publicationTypeFilter && publicationTypeFilter !== 'grant') {
      filtered = filtered.filter(c => c.publicationType === publicationTypeFilter);
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
  }, [contributions, activeTab, publicationTypeFilter, searchQuery]);

  const getFilteredGrants = useCallback(() => {
    if (!Array.isArray(grants)) return [];
    
    let filtered = [...grants];
    
    // Tab filter
    if (activeTab === 'action_required') {
      filtered = filtered.filter(g => g.status === 'changes_required');
    } else if (activeTab === 'draft') {
      filtered = filtered.filter(g => g.status === 'draft');
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(g => ['submitted', 'under_review', 'resubmitted'].includes(g.status));
    } else if (activeTab === 'completed') {
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
    
    const confirmed = await confirmAction('Confirm Submission', 'Submit this contribution for review?');
    if (!confirmed) return;
    
    try {
      await researchService.submitContribution(id);
      fetchContributions();
    } catch (error: unknown) {
      logger.error('Error submitting contribution:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading your contributions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Research Contributions</h1>
          <p className="text-gray-500 mt-1">Track and manage all your research paper submissions</p>
        </div>
        <Link
          href="/research/apply"
          className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 transition-all duration-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Contribution
        </Link>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Total</span>
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">All submissions</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">In Progress</span>
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.in_progress}</p>
          <p className="text-xs text-gray-400 mt-1">Under review</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Completed</span>
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-gray-400 mt-1">Approved</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Incentives</span>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">₹{stats.totalIncentives.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Total earned</p>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Points</span>
            <div className="p-2 bg-purple-50 rounded-lg">
              <Award className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600">{stats.totalPoints}</p>
          <p className="text-xs text-gray-400 mt-1">Research points</p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              const count = tab.key === 'all' ? stats.total :
                           tab.key === 'action_required' ? stats.action_required :
                           tab.key === 'draft' ? stats.drafts :
                           tab.key === 'in_progress' ? stats.in_progress :
                           stats.completed + stats.rejected;
              
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-200 ${
                    isActive 
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : tab.color}`} />
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Filters Bar */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, journal, conference..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="relative">
            <select
              value={publicationTypeFilter}
              onChange={(e) => setPublicationTypeFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all"
            >
              <option value="">All Publication Types</option>
              {Object.entries(PUBLICATION_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Contributions List */}
        <div className="divide-y divide-gray-100">
          {filteredContributions.length === 0 && filteredGrants.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No contributions found</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                {activeTab === 'all' 
                  ? "You haven't submitted any research contributions yet. Start by creating your first submission."
                  : `No ${TABS.find(t => t.key === activeTab)?.label.toLowerCase()} contributions to display.`}
              </p>
              <Link
                href="/research/apply"
                className="inline-flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Contribution
              </Link>
            </div>
          ) : (
            <>
            {/* Grant Applications */}
            {filteredGrants.map((grant, index) => {
              const statusConfig = STATUS_CONFIG[grant.status] || STATUS_CONFIG.draft;
              const StatusIcon = statusConfig.icon;
              const pubTypeConfig = PUBLICATION_TYPE_CONFIG['grant_proposal'];
              const PubTypeIcon = pubTypeConfig?.icon || FileText;
              
              return (
                <div key={`grant-${grant.id}`} className="relative">
                  <Link
                    href={`/research/grant/${grant.id}`}
                    className={`block p-5 hover:bg-gray-50/80 transition-all duration-200 ${
                      index === 0 ? 'rounded-t-none' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Grant Type Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${pubTypeConfig?.gradient || 'bg-gradient-to-br from-blue-500 to-blue-600'} shadow-lg`}>
                        <PubTypeIcon className="w-6 h-6 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 line-clamp-1 mb-1">
                              {grant.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                              <span className="inline-flex items-center">
                                <span className="font-medium text-gray-700">{grant.agencyName || 'N/A'}</span>
                              </span>
                              {grant.submittedAmount && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  Amount: ₹{Number(grant.submittedAmount).toLocaleString()}
                                </span>
                              )}
                              {grant.applicationNumber && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  {grant.applicationNumber}
                                </span>
                              )}
                            </div>
                            {grant.projectType && (
                              <div className="mt-2">
                                <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                                  {grant.projectType === 'indian' ? 'Indian Project' : 'International Project'}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Status & Actions */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig.borderColor} ${statusConfig.bgColor} ${statusConfig.color}`}>
                              <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
                              {statusConfig.label}
                            </div>
                            
                            {/* Action Buttons for Draft */}
                            {grant.status === 'draft' && (
                              <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                                <button
                                  onClick={(e) => handleGrantSubmit(grant.id, e)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Submit for review"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => handleGrantDelete(grant.id, e)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete draft"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                        
                        {/* Date Info */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                          <span>Created: {new Date(grant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          {grant.updatedAt && grant.updatedAt !== grant.createdAt && (
                            <span>Updated: {new Date(grant.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
            
            {/* Research Contributions */}
            {(
            filteredContributions.map((contribution, index) => {
              const statusConfig = STATUS_CONFIG[contribution.status] || STATUS_CONFIG.draft;
              const StatusIcon = statusConfig.icon;
              const pubTypeConfig = PUBLICATION_TYPE_CONFIG[contribution.publicationType];
              const PubTypeIcon = pubTypeConfig?.icon || FileText;
              const isExpanded = expandedApp === contribution.id;
              
              return (
                <div key={contribution.id} className="relative">
                  <Link
                    href={`/research/contribution/${contribution.id}`}
                    className={`block p-5 hover:bg-gray-50/80 transition-all duration-200 ${
                      index === 0 ? 'rounded-t-none' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Publication Type Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${pubTypeConfig?.gradient || 'bg-gradient-to-br from-gray-500 to-gray-600'} shadow-lg`}>
                        <PubTypeIcon className="w-6 h-6 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 line-clamp-1 mb-1">
                              {contribution.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                              <span className="font-medium text-gray-600">
                                {contribution.applicationNumber || 'Draft'}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-gray-300" />
                              <span>{pubTypeConfig?.label || contribution.publicationType}</span>
                              {contribution.journalName && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                                  <span className="truncate max-w-[180px]">{contribution.journalName}</span>
                                </>
                              )}
                              {contribution.conferenceName && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                                  <span className="truncate max-w-[180px]">{contribution.conferenceName}</span>
                                </>
                              )}
                            </div>
                            
                            {/* Incentives Display */}
                            {contribution.calculatedIncentiveAmount && (
                              <div className="flex items-center gap-3 mt-2">
                                {['approved', 'completed'].includes(contribution.status) && contribution.incentiveAmount ? (
                                  <>
                                    <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                                      <Coins className="w-3.5 h-3.5 mr-1.5" />
                                      ₹{Number(contribution.incentiveAmount).toLocaleString()}
                                    </span>
                                    {contribution.pointsAwarded && (
                                      <span className="inline-flex items-center px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
                                        <Award className="w-3.5 h-3.5 mr-1.5" />
                                        {contribution.pointsAwarded} pts
                                      </span>
                                    )}
                                    <span className="text-xs text-green-600 font-medium">✓ Credited</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                                      <Coins className="w-3.5 h-3.5 mr-1.5" />
                                      ₹{Number(contribution.calculatedIncentiveAmount).toLocaleString()}
                                    </span>
                                    {contribution.calculatedPoints && (
                                      <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                                        <Award className="w-3.5 h-3.5 mr-1.5" />
                                        {contribution.calculatedPoints} pts
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-500">Estimated</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Status & Actions */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig.borderColor} ${statusConfig.bgColor} ${statusConfig.color}`}>
                              <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
                              {statusConfig.label}
                            </div>
                            
                            {/* Action Buttons for Draft */}
                            {contribution.status === 'draft' && (
                              <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                                <button
                                  onClick={(e) => handleSubmit(contribution.id, e)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Submit for review"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => handleDelete(contribution.id, e)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete draft"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            
                            {/* Resubmit for Changes Required */}
                            {contribution.status === 'changes_required' && (
                              <button
                                onClick={(e) => handleResubmit(contribution.id, e)}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Resubmit"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                        
                        {/* Date Info */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                          <span>Created: {new Date(contribution.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          {contribution.updatedAt && contribution.updatedAt !== contribution.createdAt && (
                            <span>Updated: {new Date(contribution.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })
            )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
