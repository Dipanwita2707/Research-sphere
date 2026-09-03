'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUploadUrl } from '@/shared/api/api';
import { iprService, drdReviewService, fileUploadService } from '@/features/ipr-management/services/ipr.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import IPRStatusUpdates from './IPRStatusUpdates';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit3,
  FileText,
  Download,
  User,
  Building,
  Calendar,
  CreditCard,
  MessageSquare,
  Eye,
  RefreshCw,
  Award,
  TrendingUp,
  Coins,
  Users,
} from 'lucide-react';

// Incentive Policy - Expected rewards based on IPR type
// This will be managed by admin in the future
const INCENTIVE_POLICY = {
  patent: {
    basePoints: 50,
    baseIncentive: 50000,
    description: 'Patent Filing',
    splitPolicy: 'Equal split among all inventors',
  },
  copyright: {
    basePoints: 20,
    baseIncentive: 15000,
    description: 'Copyright Registration',
    splitPolicy: 'Equal split among all creators',
  },
  trademark: {
    basePoints: 15,
    baseIncentive: 10000,
    description: 'Trademark Registration',
    splitPolicy: 'Equal split among all owners',
  },
  design: {
    basePoints: 25,
    baseIncentive: 20000,
    description: 'Design Registration',
    splitPolicy: 'Equal split among all designers',
  },
};

interface IprApplicationDetailsProps {
  applicationId: string;
}

export default function IprApplicationDetails({ applicationId }: IprApplicationDetailsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusUpdates, setStatusUpdates] = useState<any[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

  useEffect(() => {
    fetchApplicationDetails();
  }, [applicationId]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      // Try multiple endpoints in order:
      // 1. Own application (applicant)
      // 2. Mentor application (mentor reviewing)
      // 3. DRD endpoint (DRD staff with permissions)
      let data;
      try {
        data = await iprService.getMyApplicationById(applicationId);
      } catch (ownError: unknown) {
        try {
          // Try mentor endpoint
          data = await iprService.getMentorApplicationById(applicationId);
        } catch (mentorError: unknown) {
          // If mentor application fetch fails, try DRD endpoint
          data = await iprService.getApplicationById(applicationId);
        }
      }
      setApplication(data);
      // Fetch DRD status updates for this application (for timeline merging)
      try {
        setUpdatesLoading(true);
        const updates = await iprService.getStatusUpdates(data.id);
        setStatusUpdates(updates || []);
      } catch (err) {
        logger.error('Failed to fetch status updates for timeline:', err);
        setStatusUpdates([]);
      } finally {
        setUpdatesLoading(false);
      }
    } catch (error: unknown) {
      logger.error('Error fetching application:', error);
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: FileText },
      pending_mentor_approval: { color: 'bg-orange-100 text-orange-800', icon: Clock },
      submitted: { color: 'bg-[#fbe2e8] text-[#7d1a34]', icon: Clock },
      under_drd_review: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      under_dean_review: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      published: { color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
      changes_required: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
      resubmitted: { color: 'bg-[#fbe2e8] text-[#7d1a34]', icon: RefreshCw },
      drd_approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      dean_approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      drd_rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      drd_head_rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      dean_rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      govt_rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      // Kept for backward compatibility with old records
      under_finance_review: { color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
      finance_approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      finance_rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4" />
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  // Helper mapping for DRD update icons/colors when merged into timeline
  const UPDATE_ICON_MAP: Record<string, any> = {
    hearing: { Icon: Calendar, bg: 'bg-purple-100', iconColor: 'text-purple-600', label: 'Hearing' },
    document_request: { Icon: FileText, bg: 'bg-amber-100', iconColor: 'text-amber-600', label: 'Document Request' },
    milestone: { Icon: CheckCircle, bg: 'bg-green-100', iconColor: 'text-green-600', label: 'Milestone' },
    general: { Icon: MessageSquare, bg: 'bg-[#fbe2e8]', iconColor: 'text-[#7d1a34]', label: 'Update' },
  };

  const buildTimeline = () => {
    const statuses = (application?.statusHistory || []).map((h: any, idx: number) => ({
      id: `status-${h.id}`,
      kind: 'status',
      title: h.toStatus.replace(/_/g, ' ').toUpperCase(),
      time: h.changedAt,
      message: h.comments || null,
      changedBy: h.changedBy || h.changedById || null,
      seq: idx,
    }));

    const updates = (statusUpdates || []).map((u: any, idx: number) => ({
      id: `update-${u.id}`,
      kind: 'update',
      updateType: u.updateType,
      title: (UPDATE_ICON_MAP[u.updateType]?.label || u.updateType || 'Update'),
      time: u.createdAt,
      message: u.updateMessage,
      priority: u.priority,
      createdBy: u.createdBy,
      seq: (application?.statusHistory?.length || 0) + idx,
    }));

    // Combine and sort by time (newest first - reverse chronological)
    const combined = [...statuses, ...updates].sort((a, b) => {
      const ta = new Date(a.time).getTime();
      const tb = new Date(b.time).getTime();
      if (ta !== tb) return tb - ta; // Reversed: newest first
      // If timestamps equal, use seq as tie-breaker
      return (b.seq || 0) - (a.seq || 0); // Reversed
    });
    return combined;
  };

  const handleResubmit = async () => {
    if (!application) return;

    try {
      setSubmitting(true);
      await iprService.resubmitApplication(application.id);
      toast({ type: 'success', message: 'Application resubmitted successfully!' });
      fetchApplicationDetails(); // Refresh data
    } catch (error: unknown) {
      logger.error('Error resubmitting:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const getDrdReview = () => {
    if (!application?.reviews) return null;
    return application.reviews.find((r: any) => r.reviewerRole ===
   'drd_member');
  };

  const getDeanReview = () => {
    if (!application?.reviews) return null;
    return application.reviews.find((r: any) => r.reviewerRole ===
   'drd_dean');
  };

  const getFinanceReview = () => {
    if (!application?.financeRecords) return null;
    return application.financeRecords[0];
  };

  // Calculate expected incentive based on IPR type and number of inventors
  const getExpectedIncentive = () => {
    if (!application) return null;
    
    const iprType = application.iprType?.toLowerCase() || 'patent';
    const policy = INCENTIVE_POLICY[iprType as keyof typeof INCENTIVE_POLICY] || INCENTIVE_POLICY.patent;
    
    // Count inventors (from contributors or default to 1)
    const inventorCount = application.contributors?.filter((c: any) => c.contributorType ===
   'inventor')?.length || 1;
    
    // Calculate per-person share (equal split)
    const pointsPerPerson = Math.floor(policy.basePoints / inventorCount);
    const incentivePerPerson = Math.floor(policy.baseIncentive / inventorCount);
    
    return {
      totalPoints: policy.basePoints,
      totalIncentive: policy.baseIncentive,
      pointsPerPerson,
      incentivePerPerson,
      inventorCount,
      description: policy.description,
      splitPolicy: policy.splitPolicy,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7d1a34] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading application details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 dark:bg-gray-900 min-h-screen">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Error Loading Application</h2>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-4xl mx-auto p-6 dark:bg-gray-900 min-h-screen">
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">Application not found</p>
        </div>
      </div>
    );
  }

  const drdReview = getDrdReview();
  const deanReview = getDeanReview();
  const financeReview = getFinanceReview();

  return (
    <div className="max-w-6xl mx-auto p-6 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{application.title}</h1>
          <div className="flex items-center gap-4 mt-2">
            {getStatusBadge(application.status)}
            <span className="px-2 py-1 bg-[#fbe2e8] text-[#7d1a34] text-xs rounded font-medium">
              {application.iprType.toUpperCase()}
            </span>
            <span className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm rounded-lg font-bold tracking-wide shadow-sm">
              {application.applicationNumber || `ID: ${application.id.slice(0, 8).toUpperCase()}`}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Application Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">IPR Type</label>
                <p className="mt-1 text-gray-900 dark:text-white">{application.iprType.toUpperCase()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Project Type</label>
                <p className="mt-1 text-gray-900 dark:text-white">{application.projectType.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Filing Type</label>
                <p className="mt-1 text-gray-900 dark:text-white">{application.filingType}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Submitted Date</label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {application.submittedAt 
                    ? new Date(application.submittedAt).toLocaleDateString()
                    : 'Not submitted'}
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Description</label>
              <p className="mt-1 text-gray-900 dark:text-white">{application.description}</p>
            </div>

            {application.remarks && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Remarks</label>
                <p className="mt-1 text-gray-900 dark:text-white">{application.remarks}</p>
              </div>
            )}

            {application.sdgs && application.sdgs.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">SDGs</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {application.sdgs.map((sdg: any) => (
                    <span key={sdg.id} className="px-2 py-1 bg-[#fbe2e8] text-[#7d1a34] text-xs rounded">
                      {sdg.sdgCode}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Documents Section */}
          {(application.annexureFilePath || (application.supportingDocsFilePaths && application.supportingDocsFilePaths.length > 0) || application.prototypeFilePath) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-[#7d1a34]" />
                Documents & Attachments
              </h2>
              
              {/* Main Annexure Document */}
              {application.annexureFilePath && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">Main Document (Annexure)</label>
                  <a
                    href={getUploadUrl(application.annexureFilePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#7d1a34] text-white rounded-md hover:bg-[#5e1024] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Annexure
                  </a>
                </div>
              )}
              {/* Prototype ZIP for Complete Filing */}
              {application.prototypeFilePath && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">Prototype Package (ZIP)</label>
                  <a
                    href={getUploadUrl(application.prototypeFilePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Prototype ZIP
                  </a>
                </div>
              )}
              
              {/* Supporting Documents */}
              {application.supportingDocsFilePaths && application.supportingDocsFilePaths.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">Supporting Documents</label>
                  <div className="space-y-2">
                    {application.supportingDocsFilePaths.map((filePath: string, index: number) => (
                      <a
                        key={index}
                        href={getUploadUrl(filePath)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors w-fit"
                      >
                        <FileText className="w-4 h-4" />
                        Supporting Document {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Applicant Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Applicant Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {application.applicantUser ? (
                // Internal Applicant - from UserLogin with employeeDetails or studentLogin
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Name</label>
                    <p className="mt-1 text-gray-900 dark:text-white">
                      {application.applicantUser.employeeDetails?.displayName ||
                       `${application.applicantUser.employeeDetails?.firstName || ''} ${application.applicantUser.employeeDetails?.lastName || ''}`.trim() ||
                       application.applicantUser.studentLogin?.displayName ||
                       `${application.applicantUser.studentLogin?.firstName || ''} ${application.applicantUser.studentLogin?.lastName || ''}`.trim() ||
                       application.applicantUser.uid || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Email</label>
                    <p className="mt-1 text-gray-900 dark:text-white">
                      {application.applicantUser.email || 
                       application.applicantUser.employeeDetails?.email ||
                       application.applicantUser.studentLogin?.email || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">UID</label>
                    <p className="mt-1 text-gray-900 dark:text-white">{application.applicantUser.uid || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Type</label>
                    <p className="mt-1 text-gray-900 dark:text-white capitalize">
                      {application.applicantUser.role || application.applicantType?.replace('internal_', '') || 'N/A'}
                    </p>
                  </div>
                  {application.applicantUser.employeeDetails?.empId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Employee ID</label>
                      <p className="mt-1 text-gray-900 dark:text-white">{application.applicantUser.employeeDetails.empId}</p>
                    </div>
                  )}
                  {application.applicantUser.studentLogin?.studentId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Student ID</label>
                      <p className="mt-1 text-gray-900 dark:text-white">{application.applicantUser.studentLogin.studentId}</p>
                    </div>
                  )}
                  {application.applicantDetails?.phone && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Phone</label>
                      <p className="mt-1 text-gray-900 dark:text-white">{application.applicantDetails.phone}</p>
                    </div>
                  )}
                </>
              ) : application.applicantDetails?.externalName ? (
                // External Applicant
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Name</label>
                    <p className="mt-1 text-gray-900 dark:text-white">{application.applicantDetails?.externalName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Email</label>
                    <p className="mt-1 text-gray-900 dark:text-white">{application.applicantDetails?.externalEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Organization</label>
                    <p className="mt-1 text-gray-900 dark:text-white">{application.applicantDetails?.companyUniversityName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Applicant Type</label>
                    <p className="mt-1 text-gray-900 dark:text-white capitalize">{application.applicantDetails?.externalOption?.replace(/_/g, ' ') || application.applicantType?.replace(/_/g, ' ') || 'N/A'}</p>
                  </div>
                </>
              ) : (
                // Fallback - show whatever data we have from applicantDetails
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">UID</label>
                    <p className="mt-1 text-gray-900 dark:text-white">{application.applicantDetails?.uid || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Email</label>
                    <p className="mt-1 text-gray-900 dark:text-white">{application.applicantDetails?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Phone</label>
                    <p className="mt-1 text-gray-900 dark:text-white">{application.applicantDetails?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Department</label>
                    <p className="mt-1 text-gray-900 dark:text-white">{application.applicantDetails?.universityDeptName || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* DRD Review Section */}
          {drdReview && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#7d1a34]" />
                DRD Review
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Decision</label>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      drdReview.decision ===
   'approved' 
                        ? 'bg-green-100 text-green-800'
                        : drdReview.decision ===
   'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {drdReview.decision.toUpperCase()}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Comments</label>
                  <p className="mt-1 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                    {drdReview.comments || 'No comments provided'}
                  </p>
                </div>

                {drdReview.edits && Object.keys(drdReview.edits).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Suggested Edits</label>
                    <div className="mt-1 bg-orange-50 border border-orange-200 rounded-md p-3">
                      <pre className="text-sm text-orange-900 whitespace-pre-wrap">
                        {JSON.stringify(drdReview.edits, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Reviewed By</label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {drdReview.reviewer?.employeeDetails?.displayName || 'Unknown Reviewer'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Review Date</label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {drdReview.reviewedAt 
                      ? new Date(drdReview.reviewedAt).toLocaleString()
                      : 'Not reviewed yet'}
                  </p>
                </div>
              </div>

              {/* Action Buttons for Changes Required */}
              {application.status ===
   'changes_required' && drdReview.decision ===
   'changes_required' && (
                <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-md">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">Action Required</h3>
                  <p className="text-orange-800 mb-4">
                    The DRD reviewer has requested changes to your application. Please review the comments and suggestions above, then click Edit Application to make changes.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => router.push(`/ipr/applications/${application.id}/edit`)}
                      className="px-4 py-2 bg-[#7d1a34] text-white rounded-md hover:bg-[#5e1024] font-medium"
                    >
                      Edit Application
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dean Review Section */}
          {deanReview && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Dean Review
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Decision</label>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      deanReview.decision ===
   'approved' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {deanReview.decision.toUpperCase()}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Comments</label>
                  <p className="mt-1 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                    {deanReview.comments || 'No comments provided'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Reviewed By</label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {deanReview.reviewer?.employeeDetails?.displayName || 'Unknown Dean'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Review Date</label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {deanReview.reviewedAt 
                      ? new Date(deanReview.reviewedAt).toLocaleString()
                      : 'Not reviewed yet'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Finance Review Section */}
          {financeReview && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                Finance Review
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Audit Status</label>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      financeReview.auditStatus ===
   'approved' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {financeReview.auditStatus.toUpperCase()}
                    </span>
                  </p>
                </div>

                {financeReview.auditStatus ===
   'approved' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Incentive Amount</label>
                      <p className="mt-1 text-2xl font-bold text-green-600">
                        ₹{financeReview.incentiveAmount?.toLocaleString()}
                      </p>
                    </div>

                    {financeReview.pointsAwarded && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Points Awarded</label>
                        <p className="mt-1 text-xl font-semibold text-[#7d1a34]">
                          {financeReview.pointsAwarded} points
                        </p>
                      </div>
                    )}

                    {financeReview.paymentReference && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Payment Reference</label>
                        <p className="mt-1 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md font-mono">
                          {financeReview.paymentReference}
                        </p>
                      </div>
                    )}

                    {financeReview.creditedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Credited Date</label>
                        <p className="mt-1 text-gray-900 dark:text-white">
                          {new Date(financeReview.creditedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Comments</label>
                  <p className="mt-1 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                    {financeReview.auditComments || 'No comments provided'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Processed By</label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {financeReview.financeReviewer?.employeeDetails?.displayName || 'Unknown Finance Officer'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status History</h2>
            
            {/* Merged Timeline: Status Changes + DRD Updates - Scrollable */}
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {(!application?.statusHistory || application.statusHistory.length ===
   0) && (statusUpdates.length ===
   0) && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No status history available</p>
              )}

              {buildTimeline().map((item: any, idx: number, arr: any[]) => {
                const isLast = idx ===
   arr.length - 1;
                if (item.kind ===
   'status') {
                  return (
                    <div key={item.id} className="relative">
                      {!isLast && <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-[#fbe8d6]"></div>}
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 z-10">
                          <div className="w-8 h-8 bg-[#7d1a34] rounded-full flex items-center justify-center shadow-md">
                            <Calendar className="w-4 h-4 text-white" />
                          </div>
                        </div>
                                <div className="flex-1 min-w-0 pb-4">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(item.time).toLocaleString()}</p>
                          {item.message && (
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">{item.message}</p>
                          )}
                                  {item.changedBy && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      By {item.changedBy.employeeDetails?.displayName || item.changedBy.uid || item.changedBy}
                                      {item.changedBy.employeeDetails?.displayName && item.changedBy.uid && (
                                        <span>{` (${item.changedBy.uid})`}</span>
                                      )}
                                    </p>
                                  )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Update item
                const cfg = UPDATE_ICON_MAP[item.updateType] || UPDATE_ICON_MAP.general;
                const Creator = item.createdBy?.employeeDetails ? `${item.createdBy.employeeDetails.firstName} ${item.createdBy.employeeDetails.lastName}` : item.createdBy?.uid || 'DRD';
                const UpdateIcon = cfg.Icon;
                return (
                  <div key={item.id} className="relative">
                    {!isLast && <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-[#fbe8d6]"></div>}
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 z-10">
                        <div className={`${cfg.bg} w-8 h-8 rounded-full flex items-center justify-center shadow-md`}>
                          <UpdateIcon className={`${cfg.iconColor} w-4 h-4`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {cfg.label}
                          {item.priority ===
   'urgent' && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border border-red-300 rounded-full">Urgent</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(item.time).toLocaleString()}</p>
                        {item.message && (
                          <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">{item.message}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">By {Creator}{item.createdBy?.uid ? ` (${item.createdBy.uid})` : ''}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Application Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Application Info</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">School</label>
                <p className="text-sm text-gray-900 dark:text-white">{application.school?.facultyName || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Department</label>
                <p className="text-sm text-gray-900 dark:text-white">{application.department?.departmentName || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Created Date</label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {new Date(application.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Last Updated</label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {new Date(application.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
            <div className="space-y-3">
              {application.status ===
   'draft' && (
                <button
                  onClick={() => router.push(`/ipr/applications/${application.id}/edit`)}
                  className="w-full px-4 py-2 bg-[#7d1a34] text-white rounded-md hover:bg-[#5e1024] font-medium"
                >
                  Edit Application
                </button>
              )}
              
              {application.status ===
   'changes_required' && (
                <button
                  onClick={() => router.push(`/ipr/applications/${application.id}/edit`)}
                  className="w-full px-4 py-2 bg-[#7d1a34] text-white rounded-md hover:bg-[#5e1024] font-medium"
                >
                  Edit Application
                </button>
              )}

              {(application.status ===
   'completed' || application.status ===
   'finance_approved') && application.incentiveAmount && (
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <CreditCard className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">Incentive Credited</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    ₹{application.incentiveAmount.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}