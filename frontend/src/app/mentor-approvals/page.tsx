'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  User, 
  Calendar,
  Lightbulb,
  BookOpen,
  UserCheck,
  AlertCircle,
  MessageSquare,
  Send,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { iprService, IprApplication } from '@/features/ipr-management/services/ipr.service';
import { researchService, ResearchContribution } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import MentorCollaborativeReviewModal from '@/features/ipr-management/components/MentorCollaborativeReviewModal';

const IPR_TYPE_CONFIG = {
  patent: { label: 'Patent', icon: Lightbulb, color: 'bg-blue-500' },
  copyright: { label: 'Copyright', icon: FileText, color: 'bg-purple-500' },
  trademark: { label: 'Trademark', icon: FileText, color: 'bg-green-500' },
  design: { label: 'Design', icon: FileText, color: 'bg-orange-500' },
  entrepreneurship: { label: 'Entrepreneurship', icon: FileText, color: 'bg-orange-500' },
};

const RESEARCH_TYPE_CONFIG = {
  research_paper: { label: 'Research Paper', icon: FileText, color: 'bg-blue-500' },
  book: { label: 'Book / Chapter', icon: BookOpen, color: 'bg-green-500' },
  conference_paper: { label: 'Conference', icon: FileText, color: 'bg-purple-500' },
  grant_proposal: { label: 'Grant', icon: FileText, color: 'bg-orange-500' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending_mentor_approval: { label: 'Pending Your Approval', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  changes_required: { label: 'Changes Requested', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  submitted: { label: 'Submitted to DRD', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  under_review: { label: 'Under DRD Review', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  approved: { label: 'Approved', color: 'text-green-700', bgColor: 'bg-green-100' },
  completed: { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
};

type MainTab = 'ipr' | 'research';
type SubTab = 'pending' | 'history';

export default function UnifiedMentorApprovalsPage() {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [mainTab, setMainTab] = useState<MainTab>('ipr');
  const [subTab, setSubTab] = useState<SubTab>('pending');
  
  // IPR State
  const [iprPending, setIprPending] = useState<IprApplication[]>([]);
  const [iprHistory, setIprHistory] = useState<any>(null);
  const [selectedIprApp, setSelectedIprApp] = useState<IprApplication | null>(null);
  const [showIprReviewModal, setShowIprReviewModal] = useState(false);
  
  // Research State
  const [researchPending, setResearchPending] = useState<ResearchContribution[]>([]);
  const [researchHistory, setResearchHistory] = useState<ResearchContribution[]>([]);
  
  // Common State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectComments, setRejectComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [mainTab, subTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (mainTab === 'ipr') {
        if (subTab === 'pending') {
          const data = await iprService.getPendingMentorApprovals();
          setIprPending(data || []);
        } else {
          const response = await iprService.getMentorReviewHistory();
          setIprHistory(response);
        }
      } else {
        // Research - For now, show empty as research mentor approval might not be fully implemented
        // You can add research mentor approval API calls here when ready
        setResearchPending([]);
        setResearchHistory([]);
      }
    } catch (err: unknown) {
      logger.error('Error fetching data:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleIprApprove = async (app: IprApplication) => {
    setSelectedItem(app);
    setShowApprovalModal(true);
  };

  const confirmApprove = async () => {
    if (!selectedItem) return;
    
    try {
      setSubmitting(true);
      if (mainTab === 'ipr') {
        await iprService.approveMentorApplication(selectedItem.id, approvalComments);
      }
      setShowApprovalModal(false);
      setSelectedItem(null);
      setApprovalComments('');
      fetchData();
    } catch (err: unknown) {
      logger.error('Error approving:', err);
      addToast({ type: 'error', message: extractErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (item: any) => {
    setSelectedItem(item);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedItem || !rejectComments.trim()) {
      addToast({ type: 'warning', message: 'Please provide a reason for rejection' });
      return;
    }
    
    try {
      setSubmitting(true);
      if (mainTab === 'ipr') {
        await iprService.rejectMentorApplication(selectedItem.id, rejectComments);
      }
      setShowRejectModal(false);
      setSelectedItem(null);
      setRejectComments('');
      fetchData();
    } catch (err: unknown) {
      logger.error('Error rejecting:', err);
      addToast({ type: 'error', message: extractErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const openCollaborativeReview = (app: IprApplication) => {
    setSelectedIprApp(app);
    setShowIprReviewModal(true);
  };

  const renderIprCard = (app: IprApplication) => {
    const typeConfig = IPR_TYPE_CONFIG[app.iprType as keyof typeof IPR_TYPE_CONFIG] || IPR_TYPE_CONFIG.patent;
    const TypeIcon = typeConfig.icon;
    const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending_mentor_approval;

    return (
      <div key={app.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200 p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 ${typeConfig.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <TypeIcon className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">{app.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{app.description}</p>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusConfig.color} ${statusConfig.bgColor}`}>
                {statusConfig.label}
              </span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {app.applicantUser?.employeeDetails?.displayName || app.applicantUser?.uid || 'Unknown'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(app.createdAt).toLocaleDateString()}
              </span>
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                {app.applicationNumber || 'Pending'}
              </span>
            </div>
            
            <div className="flex gap-2">
              {subTab === 'pending' && (
                <>
                  <button
                    onClick={() => openCollaborativeReview(app)}
                    className="flex-1 px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Review & Suggest
                  </button>
                  <button
                    onClick={() => handleIprApprove(app)}
                    className="px-4 py-2.5 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-medium flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(app)}
                    className="px-4 py-2.5 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors font-medium flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}
              {subTab === 'history' && (
                <Link
                  href={`/ipr/applications/${app.id}`}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const stats = {
    iprPending: iprPending.length,
    iprTotal: iprHistory?.stats?.total || 0,
    iprApproved: iprHistory?.stats?.approved || 0,
    researchPending: researchPending.length,
    researchTotal: researchHistory.length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 transition-colors duration-200">
      {/* Header */}
      <div className="bg-sgt-gradient dark:bg-gradient-to-r dark:from-blue-900 dark:via-blue-800 dark:to-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Link href="/dashboard" className="inline-flex items-center text-white hover:text-sgt-100 dark:hover:text-blue-200 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Mentor Approvals</h1>
              <p className="opacity-90">Review and approve student IPR applications and research contributions</p>
            </div>
            <div className="bg-white bg-opacity-20 dark:bg-opacity-10 backdrop-blur-sm rounded-2xl p-4 border border-white border-opacity-30 dark:border-opacity-20">
              <div className="text-center">
                <UserCheck className="w-8 h-8 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.iprPending + stats.researchPending}</p>
                <p className="text-sm opacity-90">Pending Approvals</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Main Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => { setMainTab('ipr'); setSubTab('pending'); }}
                className={`px-8 py-4 font-semibold transition-colors relative ${
                  mainTab === 'ipr' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  IPR Applications
                  {stats.iprPending > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">
                      {stats.iprPending}
                    </span>
                  )}
                </div>
                {mainTab === 'ipr' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>}
              </button>
              
              <button
                onClick={() => { setMainTab('research'); setSubTab('pending'); }}
                className={`px-8 py-4 font-semibold transition-colors relative ${
                  mainTab === 'research' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Research Contributions
                  {stats.researchPending > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">
                      {stats.researchPending}
                    </span>
                  )}
                </div>
                {mainTab === 'research' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>}
              </button>
            </div>
          </div>

          {/* Sub Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex px-4">
              <button
                onClick={() => setSubTab('pending')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  subTab === 'pending' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Pending Approvals
                {mainTab === 'ipr' && stats.iprPending > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">
                    {stats.iprPending}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setSubTab('history')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  subTab === 'history' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Review History
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-gray-500">Loading...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button onClick={fetchData} className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600">
                  Retry
                </button>
              </div>
            ) : mainTab === 'ipr' && subTab === 'pending' ? (
              iprPending.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <UserCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Pending Approvals</h3>
                  <p className="text-gray-500 dark:text-gray-400">All caught up! You have no pending mentor approvals.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {iprPending.map(app => renderIprCard(app))}
                </div>
              )
            ) : mainTab === 'ipr' && subTab === 'history' ? (
              iprHistory && iprHistory.data.all.length > 0 ? (
                <div className="space-y-4">
                  {iprHistory.data.all.map((app: IprApplication) => renderIprCard(app))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No review history yet</p>
                </div>
              )
            ) : mainTab === 'research' ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Research Mentor Approvals Coming Soon</h3>
                <p className="text-gray-500">Research contribution mentor approval feature will be available soon.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Approve Application</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to approve this application? It will be submitted to DRD for review.
            </p>
            <textarea
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
              placeholder="Add comments (optional)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowApprovalModal(false); setApprovalComments(''); }}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {submitting ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reject Application</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejection. The student will receive this feedback.
            </p>
            <textarea
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              placeholder="Reason for rejection (required)"
              className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(false); setRejectComments(''); }}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={submitting || !rejectComments.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {submitting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collaborative Review Modal */}
      {showIprReviewModal && selectedIprApp && (
        <MentorCollaborativeReviewModal
          application={selectedIprApp}
          onReviewComplete={fetchData}
          onClose={() => {
            setShowIprReviewModal(false);
            setSelectedIprApp(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
