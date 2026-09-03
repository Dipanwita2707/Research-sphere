'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft,
  Eye, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  User,
  Calendar,
  Users,
  Building,
  Mail,
  Phone,
  MessageSquare,
  History,
  Lock
} from 'lucide-react';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import api from '@/shared/api/api';
import logger from '@/shared/utils/logger';

interface Application {
  id: string;
  title: string;
  description: string;
  remarks: string;
  iprType: string;
  projectType: string;
  filingType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
  contributorRole: string;
  contributorCanView: boolean;
  contributorCanEdit: boolean;
  isContributor: boolean;
  applicantUser?: {
    uid: string;
    email: string;
    employeeDetails?: {
      firstName: string;
      lastName: string;
      designation: string;
    };
  };
  applicantDetails?: any;
  contributors?: any[];
  sdgs?: { sdgCode: string; sdgTitle: string }[];
  school?: { facultyName: string; facultyCode: string };
  department?: { departmentName: string; departmentCode: string };
  statusHistory?: {
    id: string;
    fromStatus: string;
    toStatus: string;
    comments: string;
    changedAt: string;
    changedBy?: {
      uid: string;
      employeeDetails?: {
        firstName: string;
        lastName: string;
      };
    };
  }[];
  reviews?: {
    id: string;
    decision: string;
    comments: string;
    reviewerRole: string;
    reviewedAt: string;
    createdAt: string;
    reviewer?: {
      uid: string;
      employeeDetails?: {
        firstName: string;
        lastName: string;
      };
    };
  }[];
  editSuggestions?: {
    id: string;
    fieldName: string;
    originalValue: string;
    suggestedValue: string;
    status: string;
    createdAt: string;
    reviewer?: {
      uid: string;
      employeeDetails?: {
        firstName: string;
        lastName: string;
      };
    };
  }[];
}

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: any; label: string }> = {
  draft: { color: 'text-gray-600', bgColor: 'bg-gray-100', icon: FileText, label: 'Draft' },
  pending_mentor_approval: { color: 'text-orange-600', bgColor: 'bg-orange-100', icon: Clock, label: 'Pending Mentor Approval' },
  submitted: { color: 'text-[#7d1a34]', bgColor: 'bg-[#fbe2e8]', icon: Clock, label: 'Submitted' },
  under_drd_review: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock, label: 'Under DRD Review' },
  under_dean_review: { color: 'text-orange-600', bgColor: 'bg-orange-100', icon: Clock, label: 'Under Dean Review' },
  changes_required: { color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertTriangle, label: 'Changes Required' },
  resubmitted: { color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Clock, label: 'Resubmitted' },
  approved: { color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle, label: 'Approved' },
  rejected: { color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle, label: 'Rejected' },
  drd_rejected: { color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle, label: 'DRD Rejected' },
  dean_rejected: { color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle, label: 'Dean Rejected' },
  finance_processing: { color: 'text-indigo-600', bgColor: 'bg-indigo-100', icon: Clock, label: 'Finance Processing' },
  completed: { color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle, label: 'Completed' },
};

const IPR_TYPE_LABELS: Record<string, string> = {
  patent: 'Patent',
  copyright: 'Copyright',
  trademark: 'Trademark',
  design: 'Design',
};

function ContributedIPRDetailContent() {
  const params = useParams() as Record<string, string>;
  const id = params.id as string;
  
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchApplication();
    }
  }, [id]);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/ipr/contributed/${id}`);
      if (response.data.success) {
        setApplication(response.data.data);
      }
    } catch (err: any) {
      logger.error('Error fetching application:', err);
      setError(err.response?.data?.message || 'Failed to fetch application details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getApplicantName = (app: Application) => {
    if (app.applicantUser?.employeeDetails) {
      const { firstName, lastName } = app.applicantUser.employeeDetails;
      return `${firstName} ${lastName || ''}`.trim();
    }
    return app.applicantUser?.uid || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7d1a34]"></div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Access Denied or Not Found</h3>
          <p className="text-red-600 mb-4">{error || 'Application not found'}</p>
          <Link
            href="/ipr/contributed"
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Contributed IPRs
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(application.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
          <Link href="/ipr/contributed" className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{application.title}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Application ID: {application.id.substring(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          
          {/* View Only Badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg border border-amber-200">
            <Lock className="w-4 h-4" />
            <span className="font-medium">View Only Access</span>
          </div>
        </div>

        {/* Status and Type Badges */}
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 text-sm font-medium bg-[#fbe2e8] text-[#7d1a34] rounded-lg">
            {IPR_TYPE_LABELS[application.iprType] || application.iprType}
          </span>
          <span className={`px-3 py-1 text-sm font-medium rounded-lg ${statusConfig.bgColor} ${statusConfig.color}`}>
            <StatusIcon className="w-4 h-4 inline mr-1" />
            {statusConfig.label}
          </span>
          <span className="px-3 py-1 text-sm font-medium bg-purple-100 text-purple-700 rounded-lg">
            Your Role: {application.contributorRole || 'Inventor'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-[#7d1a34]" />
              Application Details
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Title</label>
                <p className="text-gray-900 dark:text-white">{application.title}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{application.description}</p>
              </div>
              
              {application.remarks && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Remarks</label>
                  <p className="text-gray-900 dark:text-white">{application.remarks}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Project Type</label>
                  <p className="text-gray-900 dark:text-white capitalize">{application.projectType?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Filing Type</label>
                  <p className="text-gray-900 dark:text-white capitalize">{application.filingType}</p>
                </div>
              </div>
              
              {application.sdgs && application.sdgs.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">SDG Goals</label>
                  <div className="flex flex-wrap gap-2">
                    {application.sdgs.map((sdg, idx) => (
                      <span key={idx} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                        {sdg.sdgTitle || sdg.sdgCode}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filed By Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-[#7d1a34]" />
              Filed By (Primary Applicant)
            </h2>
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#fbe2e8] rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-[#7d1a34]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{getApplicantName(application)}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{application.applicantUser?.uid}</p>
                {application.applicantUser?.employeeDetails?.designation && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{application.applicantUser.employeeDetails.designation}</p>
                )}
                {application.applicantUser?.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
                    <Mail className="w-4 h-4 mr-1" />
                    {application.applicantUser.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contributors/Inventors */}
          {application.contributors && application.contributors.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-[#7d1a34]" />
                All Inventors/Contributors
              </h2>
              
              <div className="space-y-3">
                {application.contributors.map((contributor, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{contributor.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{contributor.uid}</p>
                        {contributor.department && (
                          <p className="text-xs text-gray-500 dark:text-gray-500">{contributor.department}</p>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                      {contributor.role || 'Inventor'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {application.reviews && application.reviews.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-[#7d1a34]" />
                Review Comments
              </h2>
              
              <div className="space-y-4">
                {application.reviews.map((review, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-blue-400">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white capitalize">
                        {review.reviewerRole?.replace(/_/g, ' ')}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        review.decision ===
   'approved' ? 'bg-green-100 text-green-700' :
                        review.decision ===
   'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {review.decision?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {review.comments && (
                      <p className="text-gray-700 dark:text-gray-300 mb-2">{review.comments}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {review.reviewer?.employeeDetails 
                        ? `${review.reviewer.employeeDetails.firstName} ${review.reviewer.employeeDetails.lastName || ''}`
                        : review.reviewer?.uid
                      } • {formatDate(review.reviewedAt || review.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit Suggestions */}
          {application.editSuggestions && application.editSuggestions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                Requested Changes
              </h2>
              
              <div className="space-y-3">
                {application.editSuggestions.map((suggestion, idx) => (
                  <div key={idx} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white capitalize">
                        Field: {suggestion.fieldName?.replace(/_/g, ' ')}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        suggestion.status ===
   'accepted' ? 'bg-green-100 text-green-700' :
                        suggestion.status ===
   'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {suggestion.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Original:</p>
                        <p className="text-gray-700">{suggestion.originalValue || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Suggested:</p>
                        <p className="text-orange-700 font-medium">{suggestion.suggestedValue}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline/Status History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <History className="w-5 h-5 mr-2 text-[#7d1a34]" />
              Status History
            </h2>
            
            <div className="space-y-4">
              {application.statusHistory && application.statusHistory.length > 0 ? (
                application.statusHistory.map((history, idx) => {
                  const config = getStatusConfig(history.toStatus);
                  const HistoryIcon = config.icon;
                  
                  return (
                    <div key={idx} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                        <HistoryIcon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {config.label}
                        </p>
                        {history.comments && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{history.comments}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatDate(history.changedAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No status history available</p>
              )}
            </div>
          </div>

          {/* Important Dates */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-[#7d1a34]" />
              Important Dates
            </h2>
            
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(application.createdAt)}</p>
              </div>
              {application.submittedAt && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Submitted</p>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(application.submittedAt)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(application.updatedAt)}</p>
              </div>
            </div>
          </div>

          {/* School/Department */}
          {(application.school || application.department) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Building className="w-5 h-5 mr-2 text-[#7d1a34]" />
                Institution
              </h2>
              
              <div className="space-y-2">
                {application.school && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">School/Faculty</p>
                    <p className="text-sm text-gray-900 dark:text-white">{application.school.facultyName}</p>
                  </div>
                )}
                {application.department && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Department</p>
                    <p className="text-sm text-gray-900 dark:text-white">{application.department.departmentName}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContributedIPRDetailPage() {
  return (
    <ProtectedRoute>
      <ContributedIPRDetailContent />
    </ProtectedRoute>
  );
}
