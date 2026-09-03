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
  Building,
  Lightbulb,
  ArrowLeft,
  AlertCircle,
  CheckCheck,
  MessageSquare,
  Edit3,
  History,
  Send,
  RefreshCw
} from 'lucide-react';
import { iprService, IprApplication } from '@/features/ipr-management/services/ipr.service';
import MentorCollaborativeReviewModal from '@/features/ipr-management/components/MentorCollaborativeReviewModal';

const IPR_TYPE_CONFIG = {
  patent: { label: 'Patent', icon: Lightbulb, color: 'bg-[#7d1a34]' },
  copyright: { label: 'Copyright', icon: FileText, color: 'bg-purple-500' },
  trademark: { label: 'Trademark', icon: Building, color: 'bg-green-500' },
  design: { label: 'Design', icon: FileText, color: 'bg-orange-500' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending_mentor_approval: { label: 'Pending Your Approval', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  changes_required: { label: 'Changes Requested', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  submitted: { label: 'Submitted to DRD', color: 'text-[#7d1a34]', bgColor: 'bg-[#fbe2e8]' },
  under_drd_review: { label: 'Under DRD Review', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  recommended_to_head: { label: 'Recommended to Head', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  drd_head_approved: { label: 'DRD Head Approved', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  published: { label: 'Published', color: 'text-green-700', bgColor: 'bg-green-100' },
  completed: { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100' },
  draft: { label: 'Draft (Rejected)', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
};

type TabType = 'pending' | 'history';

export default function MentorApprovalsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [pendingApplications, setPendingApplications] = useState<IprApplication[]>([]);
  const [historyData, setHistoryData] = useState<{
    all: IprApplication[];
    approved: IprApplication[];
    changesRequired: IprApplication[];
    stats: { total: number; pending: number; approved: number; changesRequired: number; rejected: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState<IprApplication | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComments, setRejectComments] = useState('');

  // Collaborative review modal state
  const [showCollaborativeModal, setShowCollaborativeModal] = useState(false);

  useEffect(() => {
    // Always fetch pending count for the tab badge
    fetchPendingApprovals();
  }, []);

  useEffect(() => {
    if (activeTab ===
   'history') {
      fetchMentorHistory();
    }
  }, [activeTab]);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await iprService.getPendingMentorApprovals();
      setPendingApplications(data);
    } catch (err: unknown) {
      logger.error('Error fetching pending approvals:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchMentorHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await iprService.getMentorReviewHistory();
      // Response has { data: { all, pending, ... }, stats: {...} }
      setHistoryData({
        all: response.data.all,
        approved: response.data.approved,
        changesRequired: response.data.changesRequired,
        stats: response.stats
      });
    } catch (err: unknown) {
      logger.error('Error fetching mentor history:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp) return;
    
    try {
      setSubmitting(true);
      await iprService.approveMentorApplication(selectedApp.id, approvalComments);
      setShowApprovalModal(false);
      setSelectedApp(null);
      setApprovalComments('');
      fetchPendingApprovals();
    } catch (err: unknown) {
      logger.error('Error approving application:', err);
      addToast({ type: 'error', message: extractErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    
    if (!rejectComments.trim()) {
      addToast({ type: 'warning', message: 'Please provide a reason for rejection' });
      return;
    }
    
    try {
      setSubmitting(true);
      await iprService.rejectMentorApplication(selectedApp.id, rejectComments);
      setShowRejectModal(false);
      setSelectedApp(null);
      setRejectComments('');
      fetchPendingApprovals();
    } catch (err: unknown) {
      logger.error('Error rejecting application:', err);
      addToast({ type: 'error', message: extractErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getApplicantName = (app: IprApplication) => {
    if (app.applicantUser?.studentDetails) {
      const { firstName, lastName } = app.applicantUser.studentDetails;
      return `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown Student';
    }
    if (app.applicantUser?.studentLogin) {
      const { firstName, lastName } = app.applicantUser.studentLogin;
      return `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown Student';
    }
    if (app.applicantUser?.employeeDetails) {
      const { firstName, lastName } = app.applicantUser.employeeDetails;
      return `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown';
    }
    return 'Unknown Applicant';
  };

  const getIprTypeConfig = (type: string) => {
    return IPR_TYPE_CONFIG[type as keyof typeof IPR_TYPE_CONFIG] || IPR_TYPE_CONFIG.patent;
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, color: 'text-gray-700', bgColor: 'bg-gray-100' };
  };

  const applications = activeTab ===
   'pending' ? pendingApplications : (historyData?.all || []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7d1a34]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/ipr" className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to IPR Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mentor Approvals</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Review and approve IPR applications from your mentee students
        </p>
      </div>

      {/* Stats Cards (for history tab) */}
      {activeTab ===
   'history' && historyData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#fbe2e8] dark:bg-[#7d1a34]/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#7d1a34]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{historyData.stats.total}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Applications</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{historyData.stats.approved}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Approved</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{historyData.stats.pending}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{historyData.stats.changesRequired}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Changes Requested</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab ===
   'pending'
                ? 'border-[#7d1a34] text-[#7d1a34]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Approvals
            {pendingApplications.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                {pendingApplications.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab ===
   'history'
                ? 'border-[#7d1a34] text-[#7d1a34]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <History className="w-4 h-4" />
            My Mentee Applications
          </button>
        </nav>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {applications.length ===
   0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          {activeTab ===
   'pending' ? (
            <>
              <CheckCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Pending Approvals</h3>
              <p className="text-gray-600 dark:text-gray-400">
                You don't have any IPR applications waiting for your approval.
              </p>
            </>
          ) : (
            <>
              <History className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Applications Yet</h3>
              <p className="text-gray-600 dark:text-gray-400">
                No students have submitted IPR applications with you as mentor.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-6">
          {applications.map((app) => {
            const typeConfig = getIprTypeConfig(app.iprType);
            const TypeIcon = typeConfig.icon;
            const statusConfig = getStatusConfig(app.status);
            const isPending = app.status ===
   'pending_mentor_approval';

            return (
              <div
                key={app.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg ${typeConfig.color} flex items-center justify-center`}>
                        <TypeIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {app.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {app.applicationNumber} • {typeConfig.label}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                      {isPending ? <Clock className="w-4 h-4 mr-1" /> : 
                       app.status ===
   'submitted' || app.status ===
   'under_drd_review' ? <Send className="w-4 h-4 mr-1" /> :
                       app.status ===
   'changes_required' ? <RefreshCw className="w-4 h-4 mr-1" /> :
                       <CheckCircle className="w-4 h-4 mr-1" />}
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <User className="w-4 h-4" />
                      <span className="text-sm">
                        <strong>Student:</strong> {getApplicantName(app)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">
                        <strong>Submitted:</strong> {formatDate(app.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Building className="w-4 h-4" />
                      <span className="text-sm">
                        <strong>School:</strong> {app.school?.facultyName || app.school?.name || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {app.description && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                        {app.description}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 flex items-center gap-3 justify-end">
                    <Link
                      href={`/ipr/application/${app.id}`}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Link>
                    {isPending && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setShowCollaborativeModal(true);
                          }}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Collaborative Review
                        </button>
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setShowRejectModal(true);
                          }}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Request Changes
                        </button>
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setShowApprovalModal(true);
                          }}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Approve IPR Application
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                You are approving "{selectedApp.title}"
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Comments (Optional)
              </label>
              <textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder="Add any comments or recommendations..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={4}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Once approved, this application will be submitted for DRD review.
              </p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedApp(null);
                  setApprovalComments('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Approve & Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Request Changes
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Send "{selectedApp.title}" back to the student for revision
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Feedback / Reason for Changes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Please provide detailed feedback on what changes are needed..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={4}
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                The student will receive this feedback and can make changes before resubmitting.
              </p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedApp(null);
                  setRejectComments('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !rejectComments.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Request Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collaborative Review Modal */}
      {showCollaborativeModal && selectedApp && (
        <MentorCollaborativeReviewModal
          application={selectedApp}
          onClose={() => {
            setShowCollaborativeModal(false);
            setSelectedApp(null);
          }}
          onReviewComplete={() => {
            fetchPendingApprovals();
          }}
        />
      )}
    </div>
  );
}
