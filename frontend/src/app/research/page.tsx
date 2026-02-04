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
} from 'lucide-react';
import { researchService, ResearchContribution, ResearchPublicationType } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import logger from '@/shared/utils/logger';

const PUBLICATION_TYPES = [
  { 
    type: 'research_paper' as ResearchPublicationType, 
    label: 'Research Paper', 
    icon: FileText, 
    color: 'bg-blue-500', 
    description: 'Journal articles in indexed publications',
    href: '/research/apply?type=research_paper'
  },
  { 
    type: 'book' as ResearchPublicationType, 
    label: 'Book / Book Chapter', 
    icon: BookOpen, 
    color: 'bg-green-500', 
    description: 'Books and authored chapters',
    href: '/research/apply?type=book'
  },
  { 
    type: 'conference_paper' as ResearchPublicationType, 
    label: 'Conference Paper', 
    icon: Presentation, 
    color: 'bg-purple-500', 
    description: 'Conference proceedings and presentations',
    href: '/research/apply?type=conference_paper'
  },
  { 
    type: 'grant_proposal' as ResearchPublicationType, 
    label: 'Grant / Funding', 
    icon: DollarSign, 
    color: 'bg-orange-500', 
    description: 'Research grants and funded projects',
    href: '/research/apply-grant'
  },
];

const STATUS_CONFIG = {
  draft: { label: 'Draft', icon: FileText, color: 'text-gray-600 bg-gray-100' },
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-600 bg-blue-100' },
  under_review: { label: 'Under Review', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
  changes_required: { label: 'Changes Required', icon: AlertCircle, color: 'text-orange-600 bg-orange-100' },
  resubmitted: { label: 'Resubmitted', icon: Clock, color: 'text-blue-600 bg-blue-100' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-100' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-indigo-600 bg-indigo-100' },
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

      const myContributions = myContribRes?.data || [];
      const contributed = contributedRes?.data || [];
      
      setContributions(myContributions);
      setContributedResearch(contributed);
      
      // Calculate stats
      const allContribs = [...myContributions, ...contributed.filter(
        (c: ResearchContribution) => !myContributions.some((m: ResearchContribution) => m.id === c.id)
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
        drafts: myContributions.filter((c: ResearchContribution) => c.status === 'draft').length,
        pending: myContributions.filter((c: ResearchContribution) => 
          ['submitted', 'under_review', 'resubmitted', 'changes_required'].includes(c.status)
        ).length,
        approved: myContributions.filter((c: ResearchContribution) => 
          ['approved', 'completed'].includes(c.status)
        ).length,
        rejected: myContributions.filter((c: ResearchContribution) => c.status === 'rejected').length,
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Research & Academic Contributions</h1>
              <p className="text-gray-600 mt-1">Track and manage your research publications, books, and grants</p>
            </div>
            <Link
              href="/research/apply"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Contribution
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Contributions</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Pending Review</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Incentives</p>
                <p className="text-3xl font-bold text-green-600">₹{stats.totalIncentives.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Coins className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Points</p>
                <p className="text-3xl font-bold text-purple-600">{stats.totalPoints}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Publication Types Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Publication Types</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PUBLICATION_TYPES.map((pubType) => {
              const Icon = pubType.icon;
              const count = Array.isArray(contributions) ? contributions.filter(c => c.publicationType === pubType.type).length : 0;
              return (
                <Link
                  key={pubType.type}
                  href={pubType.href}
                  className="group bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:border-gray-300"
                >
                  <div className={`w-12 h-12 ${pubType.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{pubType.label}</h3>
                  <p className="text-gray-600 text-sm mb-2">{pubType.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{count} filed</span>
                    <div className="flex items-center text-blue-600 text-sm font-medium">
                      Apply Now
                      <Plus className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Contributions */}
        {recentContributions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Recent Contributions</h2>
                <Link 
                  href="/research/my-contributions"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  View All →
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {recentContributions.map((contribution) => {
                const statusInfo = getStatusInfo(contribution.status);
                const StatusIcon = statusInfo.icon;
                const pubType = PUBLICATION_TYPES.find(p => p.type === contribution.publicationType);
                const PubIcon = pubType?.icon || FileText;
                
                return (
                  <Link
                    key={contribution.id}
                    href={`/research/contribution/${contribution.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 ${pubType?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center`}>
                          <PubIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 line-clamp-1">{contribution.title}</h3>
                          <p className="text-sm text-gray-500">
                            {contribution.applicationNumber || 'No app number'} • {pubType?.label || contribution.publicationType}
                          </p>
                        </div>
                      </div>
                      <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                        <StatusIcon className="w-4 h-4 mr-1" />
                        {statusInfo.label}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && contributions.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No contributions yet</h3>
            <p className="text-gray-600 mb-6">Start by filing your first research contribution</p>
            <Link
              href="/research/apply"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              File New Contribution
            </Link>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}
