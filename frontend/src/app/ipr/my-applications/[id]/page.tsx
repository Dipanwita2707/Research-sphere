'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  ArrowLeft,
  Clock,
  User,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Check,
  X,
  RefreshCw,
  Send,
} from 'lucide-react';
import api from '@/shared/api/api';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import IPRStatusUpdates from '@/features/ipr-management/components/IPRStatusUpdates';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

interface EditSuggestion {
  id: string;
  fieldName: string;
  fieldPath?: string;
  originalValue?: string;
  suggestedValue: string;
  suggestionNote?: string;
  status: 'pending' | 'accepted' | 'rejected';
  applicantResponse?: string;
  respondedAt?: string;
  createdAt: string;
  reviewer: {
    uid: string;
    employeeDetails?: {
      displayName?: string;
      firstName?: string;
      lastName?: string;
    };
  };
}

interface IprApplication {
  id: string;
  applicationNumber?: string;
  title: string;
  description: string;
  iprType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  applicantUser?: {
    uid: string;
    employeeDetails?: {
      displayName?: string;
    };
  };
  school?: {
    facultyName: string;
  };
  department?: {
    departmentName: string;
  };
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_mentor_approval: 'bg-orange-100 text-orange-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_drd_review: 'bg-yellow-100 text-yellow-700',
  changes_required: 'bg-orange-100 text-orange-700',
  resubmitted: 'bg-blue-100 text-blue-700',
  recommended_to_head: 'bg-purple-100 text-purple-700',
  drd_head_approved: 'bg-green-100 text-green-700',
  drd_rejected: 'bg-red-100 text-red-700',
  submitted_to_govt: 'bg-blue-100 text-blue-700',
  govt_application_filed: 'bg-cyan-100 text-cyan-700',
  published: 'bg-indigo-100 text-indigo-700',
  // Kept for backward compatibility
  under_finance_review: 'bg-indigo-100 text-indigo-700',
  finance_approved: 'bg-green-100 text-green-700',
  finance_rejected: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_mentor_approval: 'Pending Mentor Approval',
  submitted: 'Submitted',
  under_drd_review: 'Under DRD Review',
  changes_required: 'Changes Required',
  resubmitted: 'Resubmitted',
  recommended_to_head: 'Recommended to DRD Head',
  drd_head_approved: 'DRD Head Approved',
  drd_rejected: 'Rejected by DRD',
  submitted_to_govt: 'Submitted to Government',
  govt_application_filed: 'Government Application Filed',
  published: 'Published - Incentives Credited',
  // Kept for backward compatibility
  under_finance_review: 'Published',
  finance_approved: 'Completed',
  finance_rejected: 'Rejected',
  completed: 'Completed',
};

function IprApplicationDetailContent() {
  const params = useParams() as Record<string, string>;
  const router = useRouter();
  const { toast } = useToast();
  const applicationId = params.id as string;

  const [application, setApplication] = useState<IprApplication | null>(null);
  const [suggestions, setSuggestions] = useState<EditSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [appRes, suggestionsRes] = await Promise.all([
        api.get(`/ipr/${applicationId}`),
        api.get(`/collaborative-editing/${applicationId}/suggestions`),
      ]);
      setApplication(appRes.data.data);
      setSuggestions(suggestionsRes.data.data?.suggestions || []);
    } catch (error: unknown) {
      logger.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRespondToSuggestion = async (suggestionId: string, action: 'accept' | 'reject') => {
    try {
      setResponding(suggestionId);
      await api.post(`/collaborative-editing/suggestions/${suggestionId}/respond`, {
        action,
        response: responseText || undefined,
      });
      setResponseText('');
      await fetchData();
    } catch (error: unknown) {
      logger.error('Failed to respond to suggestion:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setResponding(null);
    }
  };

  const getReviewerName = (suggestion: EditSuggestion) => {
    // Check if this is a mentor suggestion
    const isMentorSuggestion = suggestion.suggestionNote?.startsWith('[MENTOR]');
    const name = suggestion.reviewer?.employeeDetails?.displayName ||
      suggestion.reviewer?.employeeDetails?.firstName ||
      suggestion.reviewer?.uid ||
      'Reviewer';
    
    return isMentorSuggestion ? `${name} (Mentor)` : name;
  };

  const isMentorSuggestion = (suggestion: EditSuggestion) => {
    return suggestion.suggestionNote?.startsWith('[MENTOR]');
  };

  const getSuggestionNote = (suggestion: EditSuggestion) => {
    // Remove [MENTOR] prefix if present
    if (suggestion.suggestionNote?.startsWith('[MENTOR]')) {
      return suggestion.suggestionNote.replace('[MENTOR]', '').trim();
    }
    return suggestion.suggestionNote;
  };

  const pendingSuggestions = suggestions.filter((s) => s.status ===
   'pending');
  const resolvedSuggestions = suggestions.filter((s) => s.status !== 'pending');

  const readyToResubmit = pendingSuggestions.length ===
   0 && application?.status ===
   'changes_required';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900">Application not found</h2>
        <button
          onClick={() => router.push('/ipr/my-applications')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Back to My Applications
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/ipr/my-applications')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Applications
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm rounded-lg font-bold tracking-wide shadow-sm">
                ID: {application.applicationNumber || application.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <FileText className="w-7 h-7 text-blue-600" />
              {application.title}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(application.createdAt).toLocaleDateString()}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[application.status] || 'bg-gray-100 text-gray-700'}`}>
                {statusLabels[application.status] || application.status}
              </span>
            </div>
          </div>
          <button
            onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Application Details Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Application Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
            <p className="font-medium text-gray-900 dark:text-white capitalize">{application.iprType?.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">School</p>
            <p className="font-medium text-gray-900 dark:text-white">{application.school?.facultyName || 'N/A'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
            <p className="font-medium text-gray-900 dark:text-white">{application.description || 'No description provided'}</p>
          </div>
        </div>
      </div>

      {/* Changes Required Alert */}
      {application.status ===
   'changes_required' && pendingSuggestions.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-orange-800">Changes Required</h3>
              <p className="text-sm text-orange-700 mt-1">
                {pendingSuggestions.some(s => isMentorSuggestion(s))
                  ? `Your mentor has requested ${pendingSuggestions.filter(s => isMentorSuggestion(s)).length} change(s) to your application.`
                  : `The DRD reviewer has requested ${pendingSuggestions.length} change(s) to your application.`
                }
                {' '}Please review and respond to each suggestion below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Suggestions */}
      {pendingSuggestions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Pending Changes ({pendingSuggestions.length})
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review each suggestion and accept or reject the proposed changes
            </p>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {pendingSuggestions.map((suggestion) => (
              <div key={suggestion.id} className={`p-4 ${isMentorSuggestion(suggestion) ? 'bg-purple-50' : 'bg-orange-50'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium uppercase tracking-wide ${isMentorSuggestion(suggestion) ? 'text-purple-600' : 'text-orange-600'}`}>
                        {suggestion.fieldName}
                      </span>
                      {isMentorSuggestion(suggestion) && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          Mentor
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Suggested by {getReviewerName(suggestion)} •{' '}
                      {new Date(suggestion.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${isMentorSuggestion(suggestion) ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                    Pending
                  </span>
                </div>

                {suggestion.originalValue && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600 font-medium mb-1">Current Value:</p>
                    <p className="text-sm text-red-800">{suggestion.originalValue}</p>
                  </div>
                )}

                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-600 font-medium mb-1">Suggested Change:</p>
                  <p className="text-sm text-green-800">{suggestion.suggestedValue}</p>
                </div>

                {getSuggestionNote(suggestion) && (
                    <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">
                      {isMentorSuggestion(suggestion) ? 'Mentor Note:' : 'Reviewer Note:'}
                    </p>
                      <p className="text-sm text-gray-800 dark:text-gray-300">{getSuggestionNote(suggestion)}</p>
                  </div>
                )}

                {/* Response Input */}
                <div className="mt-4">
                  <textarea
                    placeholder="Optional: Add a response or comment..."
                    value={responding ===
   suggestion.id ? responseText : ''}
                    onChange={(e) => {
                      if (responding ===
   suggestion.id) {
                        setResponseText(e.target.value);
                      }
                    }}
                    onFocus={() => setResponding(suggestion.id)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => handleRespondToSuggestion(suggestion.id, 'accept')}
                    disabled={responding ===
   suggestion.id}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {responding ===
   suggestion.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Accept Change
                  </button>
                  <button
                    onClick={() => handleRespondToSuggestion(suggestion.id, 'reject')}
                    disabled={responding ===
   suggestion.id}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompt to resubmit when all suggestions are resolved */}
      {readyToResubmit && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-green-800">All suggestions resolved</h4>
              <p className="text-sm text-green-700">You have resolved all suggested edits. You can resubmit your application for review.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    setLoading(true);
                    await api.post(`/ipr/${applicationId}/resubmit`, {}, { withCredentials: true });
                    await fetchData();
                    toast({ type: 'success', message: 'Application resubmitted successfully' });
                  } catch (err: unknown) {
                    logger.error('Resubmit failed', err);
                    toast({ type: 'error', message: 'Failed to resubmit. Please try from application details to attach files, if needed.' });
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Resubmit Application
              </button>
              <a href={`/ipr/applications/${applicationId}`} className="px-3 py-2 bg-white border border-green-200 text-green-700 rounded-md">Open Details</a>
            </div>
          </div>
        </div>
      )}

      {/* Status Updates Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Status History</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track all updates and communications from DRD
          </p>
        </div>
        <div className="p-6">
          <IPRStatusUpdates applicationId={application.id} isDRD={false} />
        </div>
      </div>

      {/* Resolved Suggestions */}
      {resolvedSuggestions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-gray-500" />
              Resolved Suggestions ({resolvedSuggestions.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {resolvedSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      {suggestion.fieldName}
                    </span>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {getReviewerName(suggestion)} •{' '}
                      {new Date(suggestion.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      suggestion.status ===
   'accepted'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {suggestion.status ===
   'accepted' ? 'Accepted' : 'Rejected'}
                  </span>
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  <strong>Suggested:</strong> {suggestion.suggestedValue}
                </p>

                {suggestion.applicantResponse && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    <strong>Your response:</strong> {suggestion.applicantResponse}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Suggestions */}
      {suggestions.length ===
   0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Edit Suggestions</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            No changes have been requested for this application yet.
          </p>
        </div>
      )}
    </div>
  );
}

export default function IprApplicationDetailPage() {
  return (
    <ProtectedRoute>
      <IprApplicationDetailContent />
    </ProtectedRoute>
  );
}
