'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Eye, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  User,
  Calendar,
  ArrowLeft,
  Users,
  Lightbulb
} from 'lucide-react';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import api from '@/shared/api/api';
import logger from '@/shared/utils/logger';

interface Contributor {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
}

interface Application {
  id: string;
  title: string;
  iprType: string;
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
    employeeDetails?: {
      firstName: string;
      lastName: string;
    };
  };
  applicantDetails?: {
    uid: string;
    email: string;
  };
  contributors?: Contributor[];
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

function ContributedIPRsContent() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  useEffect(() => {
    fetchContributedApplications();
  }, []);

  const fetchContributedApplications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/ipr/contributed');
      if (response.data.success) {
        setApplications(response.data.data || []);
      }
    } catch (err: any) {
      logger.error('Error fetching contributed applications:', err);
      setError(err.response?.data?.message || 'Failed to fetch applications');
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link href="/ipr" className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Users className="w-7 h-7 mr-3 text-[#7d1a34]" />
              IPR Applications (As Contributor/Inventor)
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View IPR applications where you have been added as an inventor or contributor.
              You can view the status and details but cannot edit these applications.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {applications.length ===
   0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Contributed Applications</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You haven't been added as an inventor or contributor to any IPR applications yet.
          </p>
          <Link
            href="/ipr/apply"
            className="inline-flex items-center px-4 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024]"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            File Your Own IPR Application
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => {
            const statusConfig = getStatusConfig(app.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <div
                key={app.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Title and Type */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 text-xs font-medium bg-[#fbe2e8] text-[#7d1a34] rounded">
                        {IPR_TYPE_LABELS[app.iprType] || app.iprType}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig.label}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                        Role: {app.contributorRole || 'Inventor'}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{app.title}</h3>
                    
                    {/* Filed By Info */}
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <User className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
                      <span className="font-medium">Filed by:</span>
                      <span className="ml-2">{getApplicantName(app)}</span>
                      {app.applicantUser?.uid && (
                        <span className="ml-2 text-gray-400 dark:text-gray-500">({app.applicantUser.uid})</span>
                      )}
                    </div>
                    
                    {/* Dates */}
                    <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Created: {formatDate(app.createdAt)}
                      </div>
                      {app.submittedAt && (
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Submitted: {formatDate(app.submittedAt)}
                        </div>
                      )}
                    </div>

                    {/* Other Contributors */}
                    {app.contributors && app.contributors.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <Users className="w-4 h-4 inline mr-1" />
                          Other Inventors/Contributors:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {app.contributors.map((contributor, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                            >
                              {contributor.name} ({contributor.uid})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Latest Status Update */}
                    {app.statusHistory && app.statusHistory.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Latest Update:</span>{' '}
                          {app.statusHistory[0].comments || `Status changed to ${app.statusHistory[0].toStatus}`}
                          <span className="text-gray-400 dark:text-gray-500 ml-2">
                            ({formatDate(app.statusHistory[0].changedAt)})
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* View Button */}
                  <div className="ml-4">
                    <Link
                      href={`/ipr/contributed/${app.id}`}
                      className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ContributedIPRsPage() {
  return (
    <ProtectedRoute>
      <ContributedIPRsContent />
    </ProtectedRoute>
  );
}
