'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Edit3, 
  MessageSquare, 
  Clock, 
  User, 
  Shield,
  FileText,
  AlertTriangle
} from 'lucide-react';
import CollaborativeEditor from './CollaborativeEditor';
import collaborativeEditingService, { EditSuggestion } from '@/features/ipr-management/services/collaborativeEditing.service';
import { drdReviewService } from '@/features/ipr-management/services/ipr.service';
import api from '@/shared/api/api';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

interface CollaborativeReviewModalProps {
  application: any;
  onClose: () => void;
  onReviewComplete: () => void;
}

export default function CollaborativeReviewModal({ 
  application, 
  onClose, 
  onReviewComplete 
}: CollaborativeReviewModalProps) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [reviewMode, setReviewMode] = useState<'collaborative' | 'traditional'>('collaborative');
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [reviewData, setReviewData] = useState({
    decision: 'recommended' as 'approved' | 'rejected' | 'changes_required' | 'recommended',
    comments: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Permission flags - simplified 4 permission model
  const canApprove = userPermissions.ipr_approve || userPermissions.drd_ipr_approve;

  // Form field states for collaborative editing
  const [formData, setFormData] = useState({
    title: application?.title || '',
    description: application?.description || '',
    remarks: application?.remarks || '',
    iprType: application?.iprType || '',
    projectType: application?.projectType || '',
    filingType: application?.filingType || ''
  });

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  useEffect(() => {
    if (application) {
      loadEditSuggestions();
      setFormData({
        title: application.title || '',
        description: application.description || '',
        remarks: application.remarks || '',
        iprType: application.iprType || '',
        projectType: application.projectType || '',
        filingType: application.filingType || ''
      });
    }
  }, [application]);

  const fetchUserPermissions = async () => {
    try {
      const response = await api.get('/dashboard/staff');
      const allPermissions: Record<string, boolean> = {};
      
      if (response.data.success && response.data.data.permissions) {
        response.data.data.permissions.forEach((dept: any) => {
          if (Array.isArray(dept.permissions)) {
            dept.permissions.forEach((perm: string) => {
              allPermissions[perm] = true;
              const permLower = perm.toLowerCase().replace(/\s+/g, '_');
              
              // Map to new simplified permission names
              if (permLower.includes('approve') && permLower.includes('ipr')) {
                allPermissions['ipr_approve'] = true;
                allPermissions['drd_ipr_approve'] = true;
              }
              if (permLower.includes('recommend')) {
                allPermissions['ipr_review'] = true;
                allPermissions['drd_ipr_recommend'] = true;
              }
            });
          }
        });
      }
      
      setUserPermissions(allPermissions);
      // Set default decision based on permissions
      setReviewData(prev => ({
        ...prev,
        decision: (allPermissions.ipr_approve || allPermissions.drd_ipr_approve) ? 'approved' : 'recommended'
      }));
    } catch (error: unknown) {
      logger.error('Error fetching permissions:', error);
    }
  };

  const loadEditSuggestions = async () => {
    try {
      setLoading(true);
      const result = await collaborativeEditingService.getEditSuggestions(application.id);
      setEditSuggestions(result.data.suggestions);
      setPendingSuggestionsCount(result.data.summary.pending);
    } catch (error: unknown) {
      logger.error('Failed to load edit suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCollaborativeReview = async () => {
    if (pendingSuggestionsCount > 0) {
      const confirmSubmit = await confirm({
        title: 'Submit Review',
        message: `There are ${pendingSuggestionsCount} pending suggestions. Do you want to submit the review with pending suggestions? The applicant will need to respond to them.`,
        type: 'warning',
        confirmText: 'Submit'
      });
      if (!confirmSubmit) return;
    }

    setSubmitting(true);
    try {
      // Submit the review based on decision
      if (reviewData.decision ===
   'approved') {
        // Only users with approve permission can approve
        if (!canApprove) {
          toast({ type: 'warning', message: 'You do not have permission to approve. Please use "Recommend" instead.' });
          return;
        }
        await drdReviewService.approveReview(application.id, reviewData.comments);
        toast({ type: 'success', message: 'Application approved successfully! Any pending suggestions have been finalized.' });
      } else if (reviewData.decision ===
   'recommended') {
        // Recommend for approval
        if (!reviewData.comments.trim()) {
          toast({ type: 'error', message: 'Comments are required when recommending' });
          return;
        }
        await drdReviewService.recommendReview(application.id, reviewData.comments);
        toast({ type: 'success', message: 'Application recommended successfully! It will now go to DRD Head for final approval.' });
      } else if (reviewData.decision ===
   'rejected') {
        if (!reviewData.comments.trim()) {
          toast({ type: 'error', message: 'Comments are required for rejection' });
          return;
        }
        await drdReviewService.rejectReview(application.id, reviewData.comments);
        toast({ type: 'success', message: 'Application rejected successfully!' });
      } else if (reviewData.decision ===
   'changes_required') {
        if (pendingSuggestionsCount ===
   0 && !reviewData.comments.trim()) {
          toast({ type: 'error', message: 'Please create edit suggestions or provide comments when requesting changes' });
          return;
        }
        // Use the collaborative editing system instead of traditional edits
        await drdReviewService.requestChanges(
          application.id, 
          reviewData.comments || `Review completed with ${pendingSuggestionsCount} collaborative edit suggestions. Please review and respond to each suggestion.`,
          {} // No traditional edits, using collaborative system
        );
        toast({ type: 'success', message: `Changes requested successfully! The applicant will see ${pendingSuggestionsCount} edit suggestions to review.` });
      }

      onReviewComplete();
      onClose();
    } catch (error: unknown) {
      logger.error('Review submission error:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const getSuggestionCountForField = (fieldName: string) => {
    return editSuggestions.filter(s => 
      s.fieldName ===
   fieldName && s.status ===
   'pending'
    ).length;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7d1a34]"></div>
            <span>Loading review interface...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-[#fdf5ec] to-indigo-50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                <Edit3 className="w-6 h-6 text-[#7d1a34]" />
                Collaborative Review: {application.title}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {application.applicantUser?.employeeDetails?.displayName || 'External Applicant'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(application.submittedAt).toLocaleDateString()}
                </span>
                {pendingSuggestionsCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    {pendingSuggestionsCount} pending suggestions
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Review Mode Toggle */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Review Mode:</span>
            <div className="flex bg-white rounded-lg p-1 border border-gray-200">
              <button
                onClick={() => setReviewMode('collaborative')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  reviewMode ===
   'collaborative'
                    ? 'bg-[#7d1a34] text-white'
                    : 'text-gray-600 hover:text-[#7d1a34]'
                }`}
              >
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Collaborative Editing
              </button>
              <button
                onClick={() => setReviewMode('traditional')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  reviewMode ===
   'traditional'
                    ? 'bg-[#7d1a34] text-white'
                    : 'text-gray-600 hover:text-[#7d1a34]'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Traditional Review
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6 space-y-6">
            
            {reviewMode ===
   'collaborative' ? (
              // Collaborative Editing Mode
              <div className="space-y-6">
                <div className="bg-[#fdf5ec] border border-[#f0e2d2] rounded-lg p-4">
                  <h3 className="font-medium text-[#7d1a34] mb-2 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Collaborative Review Instructions
                  </h3>
                  <p className="text-[#7d1a34] text-sm">
                    In this mode, you can directly suggest edits to any field. The applicant will see your suggestions 
                    and can accept or reject them. Click "Suggest Edit" on any field to make changes with explanations.
                  </p>
                </div>

                {/* Collaborative Form Fields */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Basic Information
                    </h3>
                    
                    <CollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="title"
                      currentValue={formData.title}
                      isReviewer={true}
                      label="IPR Title"
                      placeholder="Enter IPR title..."
                      onChange={(value) => handleFieldChange('title', value)}
                    />

                    <CollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="iprType"
                      currentValue={formData.iprType}
                      isReviewer={true}
                      label="IPR Type"
                      onChange={(value) => handleFieldChange('iprType', value)}
                    />

                    <CollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="projectType"
                      currentValue={formData.projectType}
                      isReviewer={true}
                      label="Project Type"
                      onChange={(value) => handleFieldChange('projectType', value)}
                    />

                    <CollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="filingType"
                      currentValue={formData.filingType}
                      isReviewer={true}
                      label="Filing Type"
                      onChange={(value) => handleFieldChange('filingType', value)}
                    />
                  </div>

                  {/* Description and Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Description & Details
                    </h3>

                    <CollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="description"
                      currentValue={formData.description}
                      isReviewer={true}
                      label="Description"
                      placeholder="Enter detailed description..."
                      multiline={true}
                      onChange={(value) => handleFieldChange('description', value)}
                    />

                    <CollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="remarks"
                      currentValue={formData.remarks}
                      isReviewer={true}
                      label="Remarks"
                      placeholder="Additional remarks..."
                      multiline={true}
                      onChange={(value) => handleFieldChange('remarks', value)}
                    />
                  </div>
                </div>

                {/* Review Summary */}
                {editSuggestions.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Suggestion Summary
                    </h3>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="bg-white rounded-lg p-3 border">
                        <div className="text-2xl font-bold text-[#7d1a34]">{editSuggestions.length}</div>
                        <div className="text-sm text-gray-600">Total</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border">
                        <div className="text-2xl font-bold text-orange-600">{pendingSuggestionsCount}</div>
                        <div className="text-sm text-gray-600">Pending</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border">
                        <div className="text-2xl font-bold text-green-600">
                          {editSuggestions.filter(s => s.status ===
   'accepted').length}
                        </div>
                        <div className="text-sm text-gray-600">Accepted</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border">
                        <div className="text-2xl font-bold text-red-600">
                          {editSuggestions.filter(s => s.status ===
   'rejected').length}
                        </div>
                        <div className="text-sm text-gray-600">Rejected</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Traditional Review Mode
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    <strong>Traditional Mode:</strong> Review the application and provide comments. 
                    Use collaborative mode for direct edit suggestions.
                  </p>
                </div>

                {/* Application Details (Read-only) */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-medium text-gray-900 mb-3">Application Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Title:</strong> {application.title}</div>
                    <div><strong>Type:</strong> {application.iprType}</div>
                    <div><strong>Description:</strong> {application.description}</div>
                    <div><strong>Remarks:</strong> {application.remarks || 'None'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Final Review Decision */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Final Review Decision</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Decision <span className="text-red-500">*</span>
                  </label>
                  {/* Permission Info */}
                  {!canApprove && (
                    <div className="mb-2 p-2 bg-[#fdf5ec] border border-[#f0e2d2] rounded-md text-sm text-[#7d1a34]">
                      <Shield className="w-4 h-4 inline mr-1" />
                      You can <strong>Recommend</strong> applications. Only DRD Head can give final approval.
                    </div>
                  )}
                  <select
                    value={reviewData.decision}
                    onChange={(e) => setReviewData({ ...reviewData, decision: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7d1a34] focus:border-[#7d1a34]"
                  >
                    {canApprove ? (
                      <>
                        <option value="approved">Approve Application</option>
                        <option value="changes_required">Request Changes</option>
                        <option value="rejected">Reject Application</option>
                      </>
                    ) : (
                      <>
                        <option value="recommended">Recommend for Approval</option>
                        <option value="changes_required">Request Changes</option>
                        <option value="rejected">Reject Application</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Comments
                    {(reviewData.decision ===
   'rejected' || 
                      reviewData.decision ===
   'recommended' ||
                      (reviewData.decision ===
   'changes_required' && reviewMode ===
   'traditional')) && 
                      <span className="text-red-500"> *</span>
                    }
                  </label>
                  <textarea
                    value={reviewData.comments}
                    onChange={(e) => setReviewData({ ...reviewData, comments: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7d1a34] focus:border-[#7d1a34]"
                    placeholder={
                      reviewMode ===
   'collaborative' 
                        ? "Optional: Add additional comments about your review or suggestions..."
                        : "Provide detailed comments about your review decision..."
                    }
                  />
                </div>

                {reviewMode ===
   'collaborative' && pendingSuggestionsCount > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-orange-800 text-sm">
                      <strong>Note:</strong> You have {pendingSuggestionsCount} pending suggestions. 
                      The applicant will need to respond to these suggestions before the review is complete.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex gap-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCollaborativeReview}
            disabled={submitting}
            className="flex-2 px-8 py-3 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Submit Review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}