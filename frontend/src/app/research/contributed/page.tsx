'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Users,
  Award,
  Coins,
  BookOpen,
  Presentation,
  DollarSign,
  ChevronRight,
  Eye
} from 'lucide-react';
import { researchService, ResearchContribution, ResearchPublicationType } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import logger from '@/shared/utils/logger';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  draft: { label: 'Draft', icon: FileText, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  under_review: { label: 'Under Review', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  changes_required: { label: 'Changes Required', icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  resubmitted: { label: 'Resubmitted', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
};

const PUBLICATION_TYPE_CONFIG: Record<ResearchPublicationType, { label: string; icon: React.ElementType; color: string }> = {
  research_paper: { label: 'Research Paper', icon: FileText, color: 'bg-blue-500' },
  book: { label: 'Book', icon: BookOpen, color: 'bg-green-500' },
  book_chapter: { label: 'Book Chapter', icon: BookOpen, color: 'bg-green-400' },
  conference_paper: { label: 'Conference Paper', icon: Presentation, color: 'bg-purple-500' },
  grant_proposal: { label: 'Grant', icon: DollarSign, color: 'bg-orange-500' },
};

export default function ContributedResearchPage() {
  const { user } = useAuthStore();
  const [contributions, setContributions] = useState<ResearchContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    totalIncentives: 0,
    totalPoints: 0,
  });

  useEffect(() => {
    fetchContributions();
  }, []);

  const fetchContributions = async () => {
    try {
      setLoading(true);
      const response = await researchService.getContributedResearch();
      const data = response.data || [];
      setContributions(data);
      
      // Calculate stats - only from contributions where user is co-author
      const approvedContribs = data.filter((c: ResearchContribution) => 
        ['approved', 'completed'].includes(c.status)
      );
      
      // Calculate incentive/points share for this user
      let totalIncentives = 0;
      let totalPoints = 0;
      
      approvedContribs.forEach((c: ResearchContribution) => {
        const userAuthor = c.authors?.find(a => a.userId === user?.id);
        if (userAuthor) {
          totalIncentives += Number(userAuthor.incentiveShare) || 0;
          totalPoints += Number(userAuthor.pointsShare) || 0;
        }
      });
      
      setStats({
        total: data.length,
        approved: approvedContribs.length,
        totalIncentives,
        totalPoints,
      });
    } catch (error) {
      logger.error('Error fetching contributed research:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (contribution: ResearchContribution) => {
    const userAuthor = contribution.authors?.find(a => a.userId === user?.id);
    if (!userAuthor) return null;
    
    const roleLabels: Record<string, string> = {
      first_author: 'First Author',
      corresponding_author: 'Corresponding Author',
      co_author: 'Co-Author',
      senior_author: 'Senior Author',
    };
    
    return roleLabels[userAuthor.authorRole || ''] || userAuthor.authorRole;
  };

  const getUserShare = (contribution: ResearchContribution) => {
    const userAuthor = contribution.authors?.find(a => a.userId === user?.id);
    if (!userAuthor) return { incentive: 0, points: 0 };
    
    return {
      incentive: Number(userAuthor.incentiveShare) || 0,
      points: Number(userAuthor.pointsShare) || 0,
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Co-authored Research</h1>
              <p className="text-gray-600 mt-1">Research contributions where you are listed as a co-author</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Total Co-authored</span>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Approved</span>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Your Incentive Share</span>
              <Coins className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600 mt-1">₹{stats.totalIncentives.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Your Points Share</span>
              <Award className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-600 mt-1">{stats.totalPoints}</p>
          </div>
        </div>

        {/* Contributions List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Research Contributions</h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : contributions.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No co-authored research</h3>
                <p className="text-gray-500">
                  You haven't been added as a co-author to any research contributions yet
                </p>
              </div>
            ) : (
              contributions.map(contribution => {
                const statusConfig = STATUS_CONFIG[contribution.status] || STATUS_CONFIG.draft;
                const StatusIcon = statusConfig.icon;
                const pubTypeConfig = PUBLICATION_TYPE_CONFIG[contribution.publicationType];
                const PubTypeIcon = pubTypeConfig?.icon || FileText;
                const userRole = getUserRole(contribution);
                const userShare = getUserShare(contribution);
                
                return (
                  <Link
                    key={contribution.id}
                    href={`/research/contribution/${contribution.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 ${pubTypeConfig?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <PubTypeIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900 truncate">{contribution.title}</h3>
                            {userRole && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex-shrink-0">
                                {userRole}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                            <span>{contribution.applicationNumber || 'Pending'}</span>
                            <span>•</span>
                            <span>{pubTypeConfig?.label || contribution.publicationType}</span>
                            {contribution.journalName && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[200px]">{contribution.journalName}</span>
                              </>
                            )}
                          </div>
                          {contribution.status === 'approved' && (userShare.incentive > 0 || userShare.points > 0) && (
                            <div className="flex items-center space-x-3 text-sm mt-1">
                              {userShare.incentive > 0 && (
                                <span className="text-green-600 font-medium">Your share: ₹{userShare.incentive.toLocaleString()}</span>
                              )}
                              {userShare.points > 0 && (
                                <>
                                  {userShare.incentive > 0 && <span>•</span>}
                                  <span className="text-purple-600 font-medium">{userShare.points} pts</span>
                                </>
                              )}
                            </div>
                          )}
                          {/* Filed by */}
                          <div className="text-xs text-gray-400 mt-1">
                            Filed by: {contribution.applicantUser?.employeeDetails?.displayName || 
                                      contribution.applicantUser?.email || 'Unknown'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 ml-4">
                        {/* Status Badge */}
                        <div className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          <StatusIcon className="w-4 h-4 mr-1.5" />
                          {statusConfig.label}
                        </div>
                        
                        <Eye className="w-5 h-5 text-gray-400" />
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
