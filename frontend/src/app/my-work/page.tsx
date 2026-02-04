'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Lightbulb, 
  Copyright, 
  Palette, 
  Briefcase,
  BookOpen, 
  Presentation, 
  DollarSign,
  Plus, 
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Eye,
  UserCheck,
  TrendingUp,
  Award,
  Coins,
  Calendar,
} from 'lucide-react';
import { iprService } from '@/features/ipr-management/services/ipr.service';
import { researchService, ResearchContribution } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { logger } from '@/shared/utils/logger';

const IPR_TYPES = [
  { type: 'patent', label: 'Patent', icon: Lightbulb, color: 'bg-blue-500', description: 'Protect your inventions', href: '/ipr/apply?type=patent' },
  { type: 'copyright', label: 'Copyright', icon: Copyright, color: 'bg-green-500', description: 'Protect creative works', href: '/ipr/apply?type=copyright' },
  { type: 'design', label: 'Design', icon: Palette, color: 'bg-purple-500', description: 'Protect visual designs', href: '/ipr/apply?type=design' },
  { type: 'entrepreneurship', label: 'Entrepreneurship', icon: Briefcase, color: 'bg-orange-500', description: 'Business ideas', href: '/ipr/apply?type=entrepreneurship' },
];

const RESEARCH_TYPES = [
  { type: 'research_paper', label: 'Research Paper', icon: FileText, color: 'bg-blue-500', description: 'Journal articles', href: '/research/apply?type=research_paper' },
  { type: 'book', label: 'Book / Chapter', icon: BookOpen, color: 'bg-green-500', description: 'Books and chapters', href: '/research/apply?type=book' },
  { type: 'conference_paper', label: 'Conference', icon: Presentation, color: 'bg-purple-500', description: 'Conference papers', href: '/research/apply?type=conference_paper' },
  { type: 'grant_proposal', label: 'Grant / Funding', icon: DollarSign, color: 'bg-orange-500', description: 'Research grants', href: '/research/apply-grant' },
];

const IPR_STATUS_CONFIG = {
  draft: { label: 'Draft', icon: Edit, color: 'text-gray-600 bg-gray-100' },
  pending_mentor_approval: { label: 'Pending Mentor', icon: UserCheck, color: 'text-orange-600 bg-orange-100' },
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-600 bg-blue-100' },
  under_drd_review: { label: 'DRD Review', icon: Eye, color: 'text-yellow-600 bg-yellow-100' },
  drd_approved: { label: 'DRD Approved', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  under_dean_review: { label: 'Dean Review', icon: Eye, color: 'text-purple-600 bg-purple-100' },
  dean_approved: { label: 'Dean Approved', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-indigo-600 bg-indigo-100' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-100' },
};

const RESEARCH_STATUS_CONFIG = {
  draft: { label: 'Draft', icon: FileText, color: 'text-gray-600 bg-gray-100' },
  pending_mentor_approval: { label: 'Pending Mentor', icon: UserCheck, color: 'text-orange-600 bg-orange-100' },
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-600 bg-blue-100' },
  under_review: { label: 'Under Review', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
  changes_required: { label: 'Changes Required', icon: AlertCircle, color: 'text-orange-600 bg-orange-100' },
  resubmitted: { label: 'Resubmitted', icon: Clock, color: 'text-blue-600 bg-blue-100' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-100' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-indigo-600 bg-indigo-100' },
};

export default function MyWorkDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'ipr' | 'research'>('ipr');
  const [iprApplications, setIprApplications] = useState<any[]>([]);
  const [researchContributions, setResearchContributions] = useState<ResearchContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingMentorCount, setPendingMentorCount] = useState(0);
  
  const [iprStats, setIprStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    totalIncentives: 0,
    totalPoints: 0,
  });
  
  const [researchStats, setResearchStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    totalIncentives: 0,
    totalPoints: 0,
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch IPR data
      const iprData = await iprService.getMyApplications().catch(() => ({ data: [] }));
      const validIprApps = (iprData.data || iprData || []).filter((app: any) => app && app.id);
      setIprApplications(validIprApps);
      
      // Fetch Research data
      const [myContribRes, contributedRes] = await Promise.all([
        researchService.getMyContributions().catch(() => ({ success: false, data: { contributions: [] } })),
        researchService.getContributedResearch().catch(() => ({ success: false, data: [] }))
      ]);
      
      logger.debug('My Contributions Response:', myContribRes);
      logger.debug('Contributed Response:', contributedRes);
      
      // Handle API response format: { success: true, data: { contributions: [...] } }
      const myContributions = myContribRes?.data?.contributions || myContribRes?.data?.myContributions || [];
      const contributed = contributedRes?.data?.contributions || contributedRes?.data || [];
      
      logger.debug('Processed myContributions:', myContributions);
      logger.debug('Processed contributed:', contributed);
      
      setResearchContributions(Array.isArray(myContributions) ? myContributions : []);
      
      // Fetch mentor pending count
      try {
        const mentorData = await iprService.getPendingMentorApprovals();
        setPendingMentorCount(mentorData?.length || 0);
      } catch (error) {
        // Not a mentor
      }
      
      // Calculate IPR stats
      const iprCompletedStatuses = ['drd_approved', 'dean_approved', 'published', 'completed'];
      const iprCompletedApps = validIprApps.filter((app: any) => iprCompletedStatuses.includes(app.status));
      
      setIprStats({
        total: validIprApps.length,
        pending: validIprApps.filter((app: any) => 
          ['submitted', 'under_drd_review', 'under_dean_review', 'pending_mentor_approval'].includes(app.status)
        ).length,
        approved: iprCompletedApps.length,
        totalIncentives: iprCompletedApps.reduce((sum: number, app: any) => sum + (Number(app.incentiveAmount) || 0), 0),
        totalPoints: iprCompletedApps.reduce((sum: number, app: any) => sum + (Number(app.pointsAwarded) || 0), 0),
      });
      
      // Calculate Research stats
      const allContribs = [...myContributions, ...contributed.filter(
        (c: ResearchContribution) => !myContributions.some((m: ResearchContribution) => m.id === c.id)
      )];
      
      const researchCompletedStatuses = ['approved', 'completed'];
      const researchCompletedContribs = allContribs.filter((c: ResearchContribution) => 
        researchCompletedStatuses.includes(c.status)
      );
      
      setResearchStats({
        total: myContributions.length,
        pending: myContributions.filter((c: ResearchContribution) => 
          ['submitted', 'under_review', 'resubmitted', 'changes_required', 'pending_mentor_approval'].includes(c.status)
        ).length,
        approved: myContributions.filter((c: ResearchContribution) => 
          researchCompletedStatuses.includes(c.status)
        ).length,
        totalIncentives: researchCompletedContribs.reduce((sum: number, c: ResearchContribution) => 
          sum + (Number(c.incentiveAmount) || 0), 0
        ),
        totalPoints: researchCompletedContribs.reduce((sum: number, c: ResearchContribution) => 
          sum + (Number(c.pointsAwarded) || 0), 0
        ),
      });
      
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredIprApplications = iprApplications.filter(app => 
    app.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredResearchContributions = researchContributions.filter(contrib => 
    contrib.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contrib.journalName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIprStatusInfo = (status: string) => {
    return IPR_STATUS_CONFIG[status as keyof typeof IPR_STATUS_CONFIG] || IPR_STATUS_CONFIG.draft;
  };

  const getResearchStatusInfo = (status: string) => {
    return RESEARCH_STATUS_CONFIG[status as keyof typeof RESEARCH_STATUS_CONFIG] || RESEARCH_STATUS_CONFIG.draft;
  };

  const combinedStats = {
    total: iprStats.total + researchStats.total,
    pending: iprStats.pending + researchStats.pending,
    approved: iprStats.approved + researchStats.approved,
    totalIncentives: iprStats.totalIncentives + researchStats.totalIncentives,
    totalPoints: iprStats.totalPoints + researchStats.totalPoints,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 transition-colors duration-200">
      {/* Header */}
      <div className="bg-sgt-gradient dark:bg-gradient-to-r dark:from-blue-900 dark:via-blue-800 dark:to-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Research & IPR Work</h1>
              <p className="mt-2 opacity-90">Manage your intellectual property and research contributions</p>
            </div>
            <div className="flex items-center gap-3">
              {user?.userType === 'faculty' && pendingMentorCount > 0 && (
                <Link
                  href="/mentor-approvals"
                  className="relative bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-medium transition-all flex items-center border border-white border-opacity-30"
                >
                  <UserCheck className="w-5 h-5 mr-2" />
                  Mentor Approvals
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    {pendingMentorCount}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Submissions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{combinedStats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{combinedStats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Approved</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{combinedStats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Incentives</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">₹{combinedStats.totalIncentives.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Points</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{combinedStats.totalPoints}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 transition-colors">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab('ipr')}
                className={`px-8 py-4 font-semibold transition-colors relative ${
                  activeTab === 'ipr'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  IPR Applications
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'ipr' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {iprStats.total}
                  </span>
                </div>
                {activeTab === 'ipr' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('research')}
                className={`px-8 py-4 font-semibold transition-colors relative ${
                  activeTab === 'research'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Research Contributions
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'research' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {researchStats.total}
                  </span>
                </div>
                {activeTab === 'research' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder={activeTab === 'ipr' ? 'Search IPR applications...' : 'Search research contributions...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'ipr' && (
              <div>
                {/* Quick Create Cards */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New IPR Application</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {IPR_TYPES.map((iprType) => {
                      const Icon = iprType.icon;
                      return (
                        <Link
                          key={iprType.type}
                          href={iprType.href}
                          className="group bg-gradient-to-br from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200"
                        >
                          <div className={`w-10 h-10 ${iprType.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{iprType.label}</h4>
                          <p className="text-gray-600 dark:text-gray-400 text-xs">{iprType.description}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Applications List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">My IPR Applications</h3>
                    <Link href="/ipr/my-applications" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium">
                      View All →
                    </Link>
                  </div>
                  
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-500 mt-4">Loading applications...</p>
                    </div>
                  ) : filteredIprApplications.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <Lightbulb className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No IPR Applications Yet</h3>
                      <p className="text-gray-500 mb-6">Start protecting your intellectual property</p>
                      <Link
                        href="/ipr/apply"
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Create Your First IPR Application
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredIprApplications.slice(0, 5).map((app: any) => {
                        const statusInfo = getIprStatusInfo(app.status);
                        const StatusIcon = statusInfo.icon;
                        const typeInfo = IPR_TYPES.find(t => t.type === app.iprType);
                        const TypeIcon = typeInfo?.icon || Lightbulb;
                        
                        return (
                          <Link
                            key={app.id}
                            href={`/ipr/applications/${app.id}`}
                            className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200"
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 ${typeInfo?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                <TypeIcon className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-gray-900 truncate">{app.title}</h4>
                                    <p className="text-sm text-gray-500 truncate mt-1">{app.description}</p>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusInfo.color} flex items-center gap-1`}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {statusInfo.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(app.createdAt).toLocaleDateString()}
                                  </span>
                                  {app.applicationNumber && (
                                    <span className="font-mono">{app.applicationNumber}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'research' && (
              <div>
                {/* Quick Create Cards */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Research Contribution</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {RESEARCH_TYPES.map((researchType) => {
                      const Icon = researchType.icon;
                      return (
                        <Link
                          key={researchType.type}
                          href={researchType.href}
                          className="group bg-gradient-to-br from-gray-50 to-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                        >
                          <div className={`w-10 h-10 ${researchType.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-1">{researchType.label}</h4>
                          <p className="text-gray-600 text-xs">{researchType.description}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Research List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">My Research Contributions</h3>
                    <Link href="/research/my-contributions" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      View All →
                    </Link>
                  </div>
                  
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-500 mt-4">Loading contributions...</p>
                    </div>
                  ) : filteredResearchContributions.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Research Contributions Yet</h3>
                      <p className="text-gray-500 mb-6">Start documenting your research publications</p>
                      <Link
                        href="/research/apply"
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Add Your First Research Contribution
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredResearchContributions.slice(0, 5).map((contrib: ResearchContribution) => {
                        const statusInfo = getResearchStatusInfo(contrib.status);
                        const StatusIcon = statusInfo.icon;
                        const typeInfo = RESEARCH_TYPES.find(t => t.type === contrib.publicationType);
                        const TypeIcon = typeInfo?.icon || FileText;
                        
                        return (
                          <Link
                            key={contrib.id}
                            href={`/research/contribution/${contrib.id}`}
                            className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200"
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 ${typeInfo?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                <TypeIcon className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-gray-900 truncate">{contrib.title}</h4>
                                    <p className="text-sm text-gray-500 truncate mt-1">{contrib.journalName || contrib.conferenceName || 'Research Contribution'}</p>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusInfo.color} flex items-center gap-1`}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {statusInfo.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(contrib.createdAt).toLocaleDateString()}
                                  </span>
                                  {contrib.applicationNumber && (
                                    <span className="font-mono">{contrib.applicationNumber}</span>
                                  )}
                                  {contrib.status === 'completed' && (
                                    <span className="flex items-center gap-1 text-green-600">
                                      <Coins className="w-3.5 h-3.5" />
                                      ₹{Number(contrib.incentiveAmount || 0).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
