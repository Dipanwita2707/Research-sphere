'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { iprService, fileUploadService } from '@/features/ipr-management/services/ipr.service';
import { 
  ArrowLeft, 
  Save, 
  FileText, 
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  MessageSquare,
  Check,
  X,
  User,
  GraduationCap,
  Download
} from 'lucide-react';
import Link from 'next/link';
import api, { getUploadUrl } from '@/shared/api/api';
import { useAuthStore } from '@/shared/auth/authStore';
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

// SDG Options
const SDG_OPTIONS = [
  { code: '1', title: 'No Poverty' },
  { code: '2', title: 'Zero Hunger' },
  { code: '3', title: 'Good Health and Well-being' },
  { code: '4', title: 'Quality Education' },
  { code: '5', title: 'Gender Equality' },
  { code: '6', title: 'Clean Water and Sanitation' },
  { code: '7', title: 'Affordable and Clean Energy' },
  { code: '8', title: 'Decent Work and Economic Growth' },
  { code: '9', title: 'Industry, Innovation and Infrastructure' },
  { code: '10', title: 'Reduced Inequalities' },
  { code: '11', title: 'Sustainable Cities and Communities' },
  { code: '12', title: 'Responsible Consumption and Production' },
  { code: '13', title: 'Climate Action' },
  { code: '14', title: 'Life Below Water' },
  { code: '15', title: 'Life on Land' },
  { code: '16', title: 'Peace, Justice and Strong Institutions' },
  { code: '17', title: 'Partnerships for the Goals' },
];

interface EditApplicationPageProps {
  params: { id: string };
}

export default function EditApplicationPage({ params }: EditApplicationPageProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const isStudent = user?.userType ===
   'student';
  
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Suggestions state (for students only)
  const [suggestions, setSuggestions] = useState<EditSuggestion[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    remarks: '',
    projectType: '',
    filingType: '',
    selectedSdgs: [] as string[],
  });
  
  const [annexureFile, setAnnexureFile] = useState<File | null>(null);
  const [prototypeFile, setPrototypeFile] = useState<File | null>(null);

  useEffect(() => {
    fetchApplication();
    fetchSuggestions(); // Always fetch suggestions for all users
  }, [params.id]);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      const data = await iprService.getMyApplicationById(params.id);
      setApplication(data);
      
      // Populate form with existing data
      // SDGs from backend have sdgCode, not code
      setFormData({
        title: data.title || '',
        description: data.description || '',
        remarks: data.remarks || '',
        projectType: data.projectType || '',
        filingType: data.filingType || '',
        selectedSdgs: data.sdgs?.map((s: any) => s.sdgCode || s.code || '') .filter((c: string) => c) || [],
      });
    } catch (error: unknown) {
      logger.error('Error fetching application:', error);
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response = await api.get(`/collaborative-editing/${params.id}/suggestions`);
      setSuggestions(response.data.data?.suggestions || []);
    } catch (error: unknown) {
      logger.error('Error fetching suggestions:', error);
    }
  };

  const handleRespondToSuggestion = async (suggestionId: string, action: 'accept' | 'reject') => {
    try {
      setRespondingTo(suggestionId);
      await api.post(`/collaborative-editing/suggestions/${suggestionId}/respond`, {
        action,
      });
      
      // If accepted, apply the suggestion to the form
      if (action ===
   'accept') {
        const suggestion = suggestions.find(s => s.id ===
   suggestionId);
        if (suggestion) {
          applysuggestionToForm(suggestion);
        }
      }
      
      await fetchSuggestions();
    } catch (error: unknown) {
      logger.error('Failed to respond to suggestion:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setRespondingTo(null);
    }
  };

  const applysuggestionToForm = (suggestion: EditSuggestion) => {
    const fieldName = suggestion.fieldName;
    const value = suggestion.suggestedValue;
    
    if (fieldName ===
   'title') {
      setFormData(prev => ({ ...prev, title: value }));
    } else if (fieldName ===
   'description') {
      setFormData(prev => ({ ...prev, description: value }));
    } else if (fieldName ===
   'remarks') {
      setFormData(prev => ({ ...prev, remarks: value }));
    } else if (fieldName ===
   'projectType') {
      setFormData(prev => ({ ...prev, projectType: value }));
    } else if (fieldName ===
   'filingType') {
      setFormData(prev => ({ ...prev, filingType: value }));
    }
  };

  const getReviewerName = (suggestion: EditSuggestion) => {
    const isMentor = suggestion.suggestionNote?.startsWith('[MENTOR]');
    const name = suggestion.reviewer?.employeeDetails?.displayName ||
      suggestion.reviewer?.employeeDetails?.firstName ||
      suggestion.reviewer?.uid || 'Reviewer';
    const uid = suggestion.reviewer?.uid || null;
    return { name, isMentor, uid };
  };

  const getSuggestionNote = (suggestion: EditSuggestion) => {
    if (suggestion.suggestionNote?.startsWith('[MENTOR]')) {
      return suggestion.suggestionNote.replace('[MENTOR]', '').trim();
    }
    return suggestion.suggestionNote;
  };

  const getSuggestionsForField = (fieldName: string) => {
    return suggestions.filter(s => s.fieldName ===
   fieldName && s.status ===
   'pending');
  };

  const pendingSuggestions = suggestions.filter(s => s.status ===
   'pending');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSdgToggle = (code: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSdgs: prev.selectedSdgs.includes(code)
        ? prev.selectedSdgs.filter(s => s !== code)
        : [...prev.selectedSdgs, code]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Upload new annexure if provided
      let annexureFilePath = application?.annexureFilePath;
      if (annexureFile) {
        annexureFilePath = await fileUploadService.uploadFile(annexureFile, 'ipr/annexures');
      }

      // Upload new prototype if provided
      let prototypeFilePath = application?.prototypeFilePath;
      if (prototypeFile) {
        prototypeFilePath = await fileUploadService.uploadFile(prototypeFile, 'ipr/prototypes');
      }

      // (Supporting documents upload removed) keep existing supportingDocsFilePaths if present
      let supportingDocsFilePaths = application?.supportingDocsFilePaths || [];

      // Prepare update data
      const updateData = {
        title: formData.title,
        description: formData.description,
        remarks: formData.remarks,
        projectType: formData.projectType,
        filingType: formData.filingType,
        sdgs: formData.selectedSdgs.map(code => ({
          code,
          title: SDG_OPTIONS.find(s => s.code ===
   code)?.title || ''
        })),
        annexureFilePath,
        prototypeFilePath,
        // supportingDocsFilePaths (unchanged) - no new uploads available in this form
      };

      await iprService.updateApplication(params.id, updateData);
      setSuccess('Application updated successfully!');
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push(`/ipr/applications/${params.id}`);
      }, 1500);
    } catch (error: unknown) {
      logger.error('Error updating application:', error);
      setError(extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cannot Edit Application</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/ipr/my-applications"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Applications
          </Link>
        </div>
      </div>
    );
  }

  // Check if application can be edited (only draft, changes_required, or pending_mentor_approval)
  // Once resubmitted, it's under review and cannot be edited until DRD requests changes again
  const canEdit = application?.status ===
   'draft' || 
                  application?.status ===
   'changes_required' 
                  ;
  
  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cannot Edit</h2>
          <p className="text-gray-600 mb-6">
            This application cannot be edited in its current status ({application?.status}).
          </p>
          <Link
            href={`/ipr/applications/${params.id}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            View Application
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/ipr/applications/${params.id}`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Edit Application</h1>
                <p className="text-sm text-gray-500">
                  {application?.applicationNumber} • {application?.iprType?.toUpperCase()}
                </p>
              </div>
            </div>
            {application?.status ===
   'pending_mentor_approval' && (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                Pending Mentor Approval
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Changes Requested Banner */}
        {application?.status ===
   'changes_required' && application?.changesRequestedBy && (
          <div className={`mb-6 p-4 rounded-xl border ${
            application.changesRequestedBy.isMentor 
              ? 'bg-purple-50 border-purple-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              {application.changesRequestedBy.isMentor ? (
                <GraduationCap className={`w-6 h-6 mt-0.5 text-purple-600`} />
              ) : (
                <User className={`w-6 h-6 mt-0.5 text-blue-600`} />
              )}
              <div className="flex-1">
                <h3 className={`font-semibold ${
                  application.changesRequestedBy.isMentor ? 'text-purple-800' : 'text-blue-800'
                }`}>
                  Changes Requested by {application.changesRequestedBy.isMentor ? 'Mentor' : 'DRD Reviewer'}
                </h3>
                <p className={`text-sm mt-1 ${
                  application.changesRequestedBy.isMentor ? 'text-purple-700' : 'text-blue-700'
                }`}>
                  <span className="font-medium">{application.changesRequestedBy.name}</span> has requested changes to your application.
                </p>
                {application.changesRequestedBy.comments && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    application.changesRequestedBy.isMentor ? 'bg-purple-100' : 'bg-blue-100'
                  }`}>
                    <p className={`text-sm ${
                      application.changesRequestedBy.isMentor ? 'text-purple-800' : 'text-blue-800'
                    }`}>
                      <span className="font-medium">Comments:</span> {application.changesRequestedBy.comments}
                    </p>
                  </div>
                )}
                <p className={`text-xs mt-2 ${
                  application.changesRequestedBy.isMentor ? 'text-purple-600' : 'text-blue-600'
                }`}>
                  After making changes, click &quot;Save & Resubmit&quot; to send your application back for review.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Suggestions Alert - Show for all users */}
        {pendingSuggestions.length > 0 && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-orange-800">
                  {pendingSuggestions.length} Suggested Change{pendingSuggestions.length > 1 ? 's' : ''} from Reviewer
                </h3>
                <p className="text-sm text-orange-700 mt-1">
                  Your mentor or DRD reviewer has suggested changes to your application. 
                  Review each suggestion below and accept or reject them. You can also make your own edits.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter the title of your IPR"
              required
            />
            {/* Suggestions for Title - Show for all users */}
            {getSuggestionsForField('title').map(suggestion => {
              const { name, isMentor, uid } = getReviewerName(suggestion);
              return (
                <div key={suggestion.id} className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {isMentor ? (
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                    ) : (
                      <User className="w-4 h-4 text-blue-600" />
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {name} {uid && <span className="text-xs text-gray-500 ml-2">({uid})</span>} {isMentor && <span className="text-purple-600 ml-2">(Mentor)</span>}
                    </span>
                  </div>
                  <div className="text-sm text-green-700 bg-green-50 p-2 rounded mb-2">
                    <strong>Suggested:</strong> {suggestion.suggestedValue}
                  </div>
                  {getSuggestionNote(suggestion) && (
                    <p className="text-xs text-gray-600 italic mb-2">{getSuggestionNote(suggestion)}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRespondToSuggestion(suggestion.id, 'accept')}
                      disabled={respondingTo ===
   suggestion.id}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondToSuggestion(suggestion.id, 'reject')}
                      disabled={respondingTo ===
   suggestion.id}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe your invention/work in detail"
              required
            />
            {/* Suggestions for Description - Show for all users */}
            {getSuggestionsForField('description').map(suggestion => {
              const { name, isMentor, uid } = getReviewerName(suggestion);
              return (
                <div key={suggestion.id} className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {isMentor ? (
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                    ) : (
                      <User className="w-4 h-4 text-blue-600" />
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {name} {uid && <span className="text-xs text-gray-500 ml-2">({uid})</span>} {isMentor && <span className="text-purple-600 ml-2">(Mentor)</span>}
                    </span>
                  </div>
                  <div className="text-sm text-green-700 bg-green-50 p-2 rounded mb-2 max-h-32 overflow-y-auto">
                    <strong>Suggested:</strong> {suggestion.suggestedValue}
                  </div>
                  {getSuggestionNote(suggestion) && (
                    <p className="text-xs text-gray-600 italic mb-2">{getSuggestionNote(suggestion)}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRespondToSuggestion(suggestion.id, 'accept')}
                      disabled={respondingTo ===
   suggestion.id}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondToSuggestion(suggestion.id, 'reject')}
                      disabled={respondingTo ===
   suggestion.id}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Project Type & Filing Type */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Type
                </label>
                <select
                  name="projectType"
                  value={formData.projectType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select project type</option>
                  <option value="phd">PhD Research</option>
                  <option value="pg_project">PG Project</option>
                  <option value="ug_project">UG Project</option>
                  <option value="faculty_research">Faculty Research</option>
                  <option value="industry_collaboration">Industry Collaboration</option>
                  <option value="any_other">Any Other</option>
                </select>
                {/* Suggestions for Project Type - Students Only */}
                  {getSuggestionsForField('projectType').map(suggestion => {
                  const { name, isMentor, uid } = getReviewerName(suggestion);
                  return (
                    <div key={suggestion.id} className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {isMentor ? (
                          <GraduationCap className="w-4 h-4 text-purple-600" />
                        ) : (
                          <User className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="text-sm font-medium text-gray-700">
                          {name} {uid && <span className="text-xs text-gray-500 ml-2">({uid})</span>} {isMentor && <span className="text-purple-600 ml-2">(Mentor)</span>}
                        </span>
                      </div>
                      <div className="text-sm text-green-700 bg-green-50 p-2 rounded mb-2">
                        <strong>Suggested:</strong> {suggestion.suggestedValue}
                      </div>
                      {getSuggestionNote(suggestion) && (
                        <p className="text-xs text-gray-600 italic mb-2">{getSuggestionNote(suggestion)}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespondToSuggestion(suggestion.id, 'accept')}
                          disabled={respondingTo ===
   suggestion.id}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondToSuggestion(suggestion.id, 'reject')}
                          disabled={respondingTo ===
   suggestion.id}
                          className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filing Type
                </label>
                <select
                  name="filingType"
                  value={formData.filingType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select filing type</option>
                  <option value="provisional">Provisional</option>
                  <option value="complete">Complete</option>
                </select>
                {/* Suggestions for Filing Type - Students Only */}
                  {getSuggestionsForField('filingType').map(suggestion => {
                  const { name, isMentor, uid } = getReviewerName(suggestion);
                  return (
                    <div key={suggestion.id} className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {isMentor ? (
                          <GraduationCap className="w-4 h-4 text-purple-600" />
                        ) : (
                          <User className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="text-sm font-medium text-gray-700">
                          {name} {uid && <span className="text-xs text-gray-500 ml-2">({uid})</span>} {isMentor && <span className="text-purple-600 ml-2">(Mentor)</span>}
                        </span>
                      </div>
                      <div className="text-sm text-green-700 bg-green-50 p-2 rounded mb-2">
                        <strong>Suggested:</strong> {suggestion.suggestedValue}
                      </div>
                      {getSuggestionNote(suggestion) && (
                        <p className="text-xs text-gray-600 italic mb-2">{getSuggestionNote(suggestion)}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespondToSuggestion(suggestion.id, 'accept')}
                          disabled={respondingTo ===
   suggestion.id}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondToSuggestion(suggestion.id, 'reject')}
                          disabled={respondingTo ===
   suggestion.id}
                          className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SDGs */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Sustainable Development Goals (SDGs)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {SDG_OPTIONS.map((sdg) => (
                <button
                  key={sdg.code}
                  type="button"
                  onClick={() => handleSdgToggle(sdg.code)}
                  className={`p-3 rounded-lg border text-left text-sm transition-all ${
                    formData.selectedSdgs.includes(sdg.code)
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium">SDG {sdg.code}</span>
                  <p className="text-xs mt-1 opacity-75">{sdg.title}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Remarks
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Any additional information or remarks"
            />
            {/* Suggestions for Remarks - Students Only */}
              {getSuggestionsForField('remarks').map(suggestion => {
              const { name, isMentor, uid } = getReviewerName(suggestion);
              return (
                <div key={suggestion.id} className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {isMentor ? (
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                    ) : (
                      <User className="w-4 h-4 text-blue-600" />
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {name} {uid && <span className="text-xs text-gray-500 ml-2">({uid})</span>} {isMentor && <span className="text-purple-600 ml-2">(Mentor)</span>}
                    </span>
                  </div>
                  <div className="text-sm text-green-700 bg-green-50 p-2 rounded mb-2">
                    <strong>Suggested:</strong> {suggestion.suggestedValue}
                  </div>
                  {getSuggestionNote(suggestion) && (
                    <p className="text-xs text-gray-600 italic mb-2">{getSuggestionNote(suggestion)}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRespondToSuggestion(suggestion.id, 'accept')}
                      disabled={respondingTo ===
   suggestion.id}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondToSuggestion(suggestion.id, 'reject')}
                      disabled={respondingTo ===
   suggestion.id}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Documents Section - allow applicant to update annexure, prototype, supporting docs */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Documents & Attachments
            </h2>
            {/* Show existing Annexure */}
            {application.annexureFilePath && (
              <div className="mb-3">
                <label className="block text-sm text-gray-700 mb-1">Main Annexure</label>
                <a
                  href={getUploadUrl(application.annexureFilePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded text-xs text-gray-700 hover:bg-gray-200"
                >
                  <Download className="w-4 h-4" />
                  {application.annexureFilePath.split('/').pop()}
                </a>
              </div>
            )}

            {/* Show existing Prototype (for complete filing) */}
            {application.prototypeFilePath && (
              <div className="mb-3">
                <label className="block text-sm text-gray-700 mb-1">Prototype (ZIP)</label>
                <a
                  href={getUploadUrl(application.prototypeFilePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 rounded text-xs text-purple-700 hover:bg-purple-100"
                >
                  <Download className="w-4 h-4" />
                  {application.prototypeFilePath.split('/').pop()}
                </a>
              </div>
            )}

            {/* File Inputs */}
            <div className="grid gap-3">
              <div>
                <label className="text-sm text-gray-700 mb-1 block">Replace Annexure (PDF)</label>
                <input type="file" accept=".pdf" onChange={(e) => setAnnexureFile(e.target.files?.[0] || null)} />
                {annexureFile && <div className="text-xs text-gray-500 mt-1">Selected: {annexureFile.name}</div>}
              </div>

              

              {/* Supporting documents upload removed as requested. */}
              {formData.filingType ===
   'complete' && (
                <div>
                  <label className="text-sm text-gray-700 mb-1 block">Replace Prototype (ZIP)</label>
                  <input type="file" accept=".zip" onChange={(e) => setPrototypeFile(e.target.files?.[0] || null)} />
                  {prototypeFile && (
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 mt-1">Selected: {prototypeFile.name}</div>
                      <button
                        type="button"
                        onClick={() => setPrototypeFile(null)}
                        className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Annexure Document label is intentionally kept only in the upload area below. The separate 'Current Document' banner was removed to avoid duplication. */}

            {/* Upload area removed - replaced by the compact 'Replace Annexure' input above. */}
            
            {annexureFile && (
              <button
                type="button"
                onClick={() => setAnnexureFile(null)}
                className="mt-3 text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Remove new file
              </button>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <Link
              href={`/ipr/applications/${params.id}`}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
