'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Edit3, 
  MessageSquare, 
  Clock, 
  User, 
  FileText,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import MentorCollaborativeEditor from './MentorCollaborativeEditor';
import collaborativeEditingService, { EditSuggestion } from '@/features/ipr-management/services/collaborativeEditing.service';
import { iprService } from '@/features/ipr-management/services/ipr.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

interface MentorCollaborativeReviewModalProps {
  application: any;
  onClose: () => void;
  onReviewComplete: () => void;
}

export default function MentorCollaborativeReviewModal({ 
  application, 
  onClose, 
  onReviewComplete 
}: MentorCollaborativeReviewModalProps) {
  const { toast } = useToast();
  const [reviewMode, setReviewMode] = useState<'collaborative' | 'traditional'>('collaborative');
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  const [reviewData, setReviewData] = useState({
    decision: 'approved' as 'approved' | 'changes_required',
    comments: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    }
  }, [application]);

  const loadEditSuggestions = async () => {
    try {
      const result = await collaborativeEditingService.getMentorEditSuggestions(application.id);
      const suggestions = result.data?.data?.suggestions || result.data?.suggestions || [];
      setEditSuggestions(suggestions);
      setPendingSuggestionsCount(suggestions.filter((s: EditSuggestion) => s.status ===
   'pending').length);
    } catch (error: unknown) {
      logger.error('Failed to load mentor edit suggestions:', error);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMentorReview = async () => {
    setSubmitting(true);
    try {
      if (reviewData.decision ===
   'approved') {
        // Approve and send to DRD
        await iprService.approveMentorApplication(application.id, reviewData.comments);
        toast({ type: 'success', message: 'Application approved successfully! It will now be submitted to DRD for review.' });
      } else if (reviewData.decision ===
   'changes_required') {
        if (pendingSuggestionsCount ===
   0 && !reviewData.comments.trim()) {
          toast({ type: 'warning', message: 'Please create edit suggestions or provide comments when requesting changes' });
          setSubmitting(false);
          return;
        }
        // Request changes - student will need to respond
        await iprService.rejectMentorApplication(
          application.id, 
          reviewData.comments || `Please review and respond to the ${pendingSuggestionsCount} edit suggestion(s).`
        );
        
        if (pendingSuggestionsCount > 0) {
          toast({ type: 'success', message: `Changes requested successfully! The student will see ${pendingSuggestionsCount} edit suggestion(s) to review.` });
        } else {
          toast({ type: 'success', message: 'Changes requested successfully! The student will receive your feedback.' });
        }
      }

      onReviewComplete();
      onClose();
    } catch (error: unknown) {
      logger.error('Mentor review submission error:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const getApplicantName = () => {
    if (application.applicantUser?.studentLogin) {
      const { firstName, lastName } = application.applicantUser.studentLogin;
      return `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown Student';
    }
    if (application.applicantUser?.employeeDetails) {
      const { displayName, firstName, lastName } = application.applicantUser.employeeDetails;
      return displayName || `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown Applicant';
    }
    return 'Unknown Applicant';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
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
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                <GraduationCap className="w-6 h-6 text-purple-600" />
                Mentor Review: {application.title}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {getApplicantName()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(application.createdAt).toLocaleDateString()}
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
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:text-purple-600'
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
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:text-purple-600'
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
          <div className="h-full overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(90vh - 280px)' }}>
            
            {reviewMode ===
   'collaborative' ? (
              // Collaborative Editing Mode
              <div className="space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Mentor Collaborative Review Instructions
                  </h3>
                  <p className="text-purple-800 text-sm">
                    As a mentor, you can directly suggest edits to any field. Your student will see your suggestions 
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
                    
                    <MentorCollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="title"
                      currentValue={formData.title}
                      isReviewer={true}
                      label="IPR Title"
                      placeholder="Enter IPR title..."
                      onChange={(value) => handleFieldChange('title', value)}
                      onSuggestionCreated={loadEditSuggestions}
                    />

                    <MentorCollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="iprType"
                      currentValue={formData.iprType}
                      isReviewer={true}
                      label="IPR Type"
                      onChange={(value) => handleFieldChange('iprType', value)}
                      onSuggestionCreated={loadEditSuggestions}
                    />

                    <MentorCollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="projectType"
                      currentValue={formData.projectType}
                      isReviewer={true}
                      label="Project Type"
                      onChange={(value) => handleFieldChange('projectType', value)}
                      onSuggestionCreated={loadEditSuggestions}
                    />

                    <MentorCollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="filingType"
                      currentValue={formData.filingType}
                      isReviewer={true}
                      label="Filing Type"
                      onChange={(value) => handleFieldChange('filingType', value)}
                      onSuggestionCreated={loadEditSuggestions}
                    />
                  </div>

                  {/* Description and Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Description & Details
                    </h3>

                    <MentorCollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="description"
                      currentValue={formData.description}
                      isReviewer={true}
                      label="Description"
                      placeholder="Enter detailed description..."
                      multiline={true}
                      onChange={(value) => handleFieldChange('description', value)}
                      onSuggestionCreated={loadEditSuggestions}
                    />

                    <MentorCollaborativeEditor
                      iprApplicationId={application.id}
                      fieldName="remarks"
                      currentValue={formData.remarks}
                      isReviewer={true}
                      label="Remarks"
                      placeholder="Additional remarks..."
                      multiline={true}
                      onChange={(value) => handleFieldChange('remarks', value)}
                      onSuggestionCreated={loadEditSuggestions}
                    />
                  </div>
                </div>

                {/* Review Summary */}
                {editSuggestions.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-purple-600" />
                      Suggestion Summary
                    </h3>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="bg-white rounded-lg p-3 border">
                        <div className="text-2xl font-bold text-purple-600">{editSuggestions.length}</div>
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
                    <div><strong>Project Type:</strong> {application.projectType}</div>
                    <div><strong>Filing Type:</strong> {application.filingType}</div>
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
                  <select
                    value={reviewData.decision}
                    onChange={(e) => setReviewData({ ...reviewData, decision: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="approved">Approve & Submit to DRD</option>
                    <option value="changes_required">Request Changes from Student</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Comments
                    {reviewData.decision ===
   'changes_required' && pendingSuggestionsCount ===
   0 && 
                      <span className="text-red-500"> *</span>
                    }
                  </label>
                  <textarea
                    value={reviewData.comments}
                    onChange={(e) => setReviewData({ ...reviewData, comments: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder={
                      reviewMode ===
   'collaborative' 
                        ? "Optional: Add additional comments about your review or suggestions..."
                        : "Provide detailed comments about your review decision..."
                    }
                  />
                </div>

                {reviewMode ===
   'collaborative' && pendingSuggestionsCount > 0 && reviewData.decision ===
   'changes_required' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-orange-800 text-sm">
                      <strong>Note:</strong> You have {pendingSuggestionsCount} pending suggestions. 
                      The student will need to respond to these suggestions before resubmitting.
                    </p>
                  </div>
                )}

                {reviewData.decision ===
   'approved' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-800 text-sm">
                      <strong>Note:</strong> Once approved, this application will be forwarded to DRD for further review.
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
            onClick={handleMentorReview}
            disabled={submitting}
            className={`flex-2 px-8 py-3 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
              reviewData.decision ===
   'approved' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : reviewData.decision ===
   'approved' ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Approve & Submit to DRD
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                Request Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
