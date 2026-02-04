'use client';

import React, { useState, useEffect } from 'react';
import { getFileUrl, getResearchDocumentDownloadUrl } from '@/shared/api/api';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ArrowLeft,
  User,
  Building,
  Calendar,
  Globe,
  Award,
  Coins,
  ExternalLink,
  MessageSquare,
  Send,
  Loader2,
  BookOpen,
  Presentation,
  DollarSign,
  Edit3,
  Plus,
  Trash2,
  Eye,
  Save
} from 'lucide-react';
import { researchService, ResearchContribution, ResearchPublicationType } from '@/features/research-management/services/research.service';
import { permissionManagementService } from '@/features/admin-management/services/permissionManagement.service';
import progressTrackerService, { ResearchProgressTracker, StatusHistoryEntry, statusLabels, statusColors } from '@/features/research-management/services/progressTracker.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { History, GitBranch } from 'lucide-react';

// Editable field configuration
const EDITABLE_FIELDS = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'journalName', label: 'Journal Name', type: 'text' },
  { key: 'volume', label: 'Volume', type: 'text' },
  { key: 'issue', label: 'Issue', type: 'text' },
  { key: 'pageNumbers', label: 'Page Numbers', type: 'text' },
  { key: 'doi', label: 'DOI', type: 'text' },
  { key: 'issn', label: 'ISSN', type: 'text' },
  { key: 'publisherName', label: 'Weblink', type: 'text' },
  { key: 'publicationDate', label: 'Publication Date', type: 'date' },
  { key: 'publicationStatus', label: 'Publication Status', type: 'select', options: ['published', 'in_press', 'accepted', 'under_review'] },
  { key: 'targetedResearchType', label: 'Targeted Research (Indexed in)', type: 'select', options: ['scopus', 'wos', 'both'] },
  { key: 'indexingCategories', label: 'Indexing Categories', type: 'multiselect', options: [
    'nature_science_lancet_cell_nejm',
    'subsidiary_if_above_20',
    'scopus',
    'scie_wos',
    'pubmed',
    'naas_rating_6_plus',
    'abdc_scopus_wos',
    'sgtu_in_house',
    'case_centre_uk',
    'other_indexed',
    'non_indexed_reputed'
  ] },
  { key: 'impactFactor', label: 'Impact Factor', type: 'number' },
  { key: 'sjr', label: 'SJR', type: 'number' },
  { key: 'naasRating', label: 'NAAS Rating', type: 'number' },
  { key: 'subsidiaryImpactFactor', label: 'Subsidiary Impact Factor', type: 'number' },
  { key: 'quartile', label: 'Quartile', type: 'select', options: ['Top 1%', 'Top 5%', 'Q1', 'Q2', 'Q3', 'Q4'] },
  { key: 'abstract', label: 'Abstract', type: 'textarea' },
  { key: 'conferenceName', label: 'Conference Name', type: 'text' },
  { key: 'conferenceLocation', label: 'Conference Location', type: 'text' },
  { key: 'conferenceSubType', label: 'Conference Sub Type', type: 'select', options: ['paper_indexed_scopus', 'paper_not_indexed', 'keynote_speaker_invited_talks', 'organizer_coordinator_member'] },
  { key: 'conferenceType', label: 'Conference Type', type: 'select', options: ['national', 'international'] },
  { key: 'proceedingsTitle', label: 'Proceedings Title', type: 'text' },
  { key: 'proceedingsQuartile', label: 'Proceedings Quartile', type: 'select', options: ['q1', 'q2', 'q3', 'q4'] },
  { key: 'conferenceRole', label: 'Conference Role', type: 'select', options: ['main_author', 'corresponding_author', 'co_author'] },
  { key: 'indexedIn', label: 'Indexed In', type: 'select', options: ['scopus', 'wos', 'both', 'non_index'] },
  { key: 'conferenceHeldLocation', label: 'Conference Held', type: 'select', options: ['national', 'international'] },
  { key: 'venue', label: 'Venue', type: 'text' },
  { key: 'topic', label: 'Topic', type: 'text' },
  { key: 'eventCategory', label: 'Event Category', type: 'select', options: ['conference', 'seminar', 'workshop', 'symposium', 'colloquium', 'webinar'] },
  { key: 'organizerRole', label: 'Organizer Role', type: 'select', options: ['organizer', 'coordinator', 'member'] },
  { key: 'virtualConference', label: 'Virtual Conference', type: 'select', options: ['yes', 'no'] },
  { key: 'conferenceHeldAtSgt', label: 'Held at SGT', type: 'select', options: ['yes', 'no'] },
  { key: 'conferenceBestPaperAward', label: 'Best Paper Award', type: 'select', options: ['yes', 'no'] },
  { key: 'totalPresenters', label: 'Total Presenters', type: 'number' },
  { key: 'isPresenter', label: 'Is Presenter', type: 'select', options: ['yes', 'no'] },
  { key: 'fullPaper', label: 'Full Paper', type: 'select', options: ['yes', 'no'] },
  { key: 'paperDoi', label: 'Paper DOI', type: 'text' },
  { key: 'weblink', label: 'Weblink', type: 'text' },
  { key: 'issnIsbnIssueNo', label: 'ISSN/ISBN/Issue No', type: 'text' },
  { key: 'priorityFundingArea', label: 'Priority Funding Area', type: 'text' },
  { key: 'conferenceDate', label: 'Conference Date', type: 'date' },
  { key: 'isInterdisciplinary', label: 'Interdisciplinary (from SGT)', type: 'select', options: ['yes', 'no'] },
  { key: 'hasLpuStudents', label: 'Student(s) (from SGT)', type: 'select', options: ['yes', 'no'] },
  { key: 'industryCollaboration', label: 'Industry', type: 'select', options: ['yes', 'no'] },
  { key: 'communicatedWithOfficialId', label: 'Communicated with Official ID', type: 'select', options: ['yes', 'no'] },
  { key: 'centralFacilityUsed', label: 'Central Facility Used', type: 'select', options: ['yes', 'no'] },
  { key: 'attendedVirtual', label: 'Attended Virtual Conference', type: 'select', options: ['yes', 'no'] },
  { key: 'facultyRemarks', label: 'Faculty Remarks', type: 'textarea' },
  { key: 'confDatesVenue', label: 'Conference Dates & Venue Mentioned', type: 'select', options: ['yes', 'no'] },
  { key: 'pageNumbers', label: 'Page Numbers', type: 'text' },
  { key: 'paperweblink', label: 'Paper WebLink', type: 'text' },
  { key: 'grantTitle', label: 'Grant Title', type: 'text' },
  { key: 'fundingAgency', label: 'Funding Agency', type: 'text' },
  { key: 'grantAmount', label: 'Grant Amount', type: 'number' },
];

interface FieldSuggestion {
  fieldName: string;
  fieldPath?: string;
  originalValue: string;
  suggestedValue: string;
  note?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  under_review: { label: 'Under Review', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  changes_required: { label: 'Changes Required', icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  resubmitted: { label: 'Resubmitted', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
};

const PUBLICATION_TYPE_CONFIG: Record<ResearchPublicationType, { label: string; icon: React.ElementType; color: string }> = {
  research_paper: { label: 'Research Paper', icon: FileText, color: 'bg-blue-500' },
  book: { label: 'Book', icon: BookOpen, color: 'bg-green-500' },
  book_chapter: { label: 'Book Chapter', icon: BookOpen, color: 'bg-green-400' },
  conference_paper: { label: 'Conference Paper', icon: Presentation, color: 'bg-purple-500' },
  grant_proposal: { label: 'Grant', icon: DollarSign, color: 'bg-orange-500' },
};

// Helper functions for formatting display values
const formatQuartile = (quartile: string | undefined | null): string => {
  if (!quartile) return '';
  const mapping: Record<string, string> = {
    'Top_1_': 'Top 1%',
    'Top_5_': 'Top 5%',
    'top_1_': 'Top 1%',
    'top_5_': 'Top 5%',
    'top1': 'Top 1%',
    'top5': 'Top 5%',
    'q1': 'Q1',
    'q2': 'Q2',
    'q3': 'Q3',
    'q4': 'Q4',
    'Q1': 'Q1',
    'Q2': 'Q2',
    'Q3': 'Q3',
    'Q4': 'Q4',
  };
  return mapping[quartile] || quartile;
};

const formatIndexedIn = (indexedIn: string | string[] | undefined | null): string => {
  if (!indexedIn) return '';
  if (Array.isArray(indexedIn)) {
    return indexedIn.map(i => formatSingleIndexedIn(i)).join(', ');
  }
  return formatSingleIndexedIn(indexedIn);
};

const formatSingleIndexedIn = (value: string): string => {
  const mapping: Record<string, string> = {
    'both': 'Both',
    'scopus': 'Scopus',
    'wos': 'SCI/SCIE',
    'web_of_science': 'SCI/SCIE',
    'non_index': 'Non-Indexed',
  };
  return mapping[value.toLowerCase()] || value;
};

const formatSDG = (sdg: string): string => {
  // Convert sdg1 -> 1, sdg12 -> 12, etc.
  const num = sdg.replace(/[^0-9]/g, '');
  return num ? `Goal ${num}` : sdg.toUpperCase();
};

const SDG_LABELS: Record<string, string> = {
  'sdg1': 'No Poverty',
  'sdg2': 'Zero Hunger',
  'sdg3': 'Good Health and Well-being',
  'sdg4': 'Quality Education',
  'sdg5': 'Gender Equality',
  'sdg6': 'Clean Water and Sanitation',
  'sdg7': 'Affordable and Clean Energy',
  'sdg8': 'Decent Work and Economic Growth',
  'sdg9': 'Industry, Innovation and Infrastructure',
  'sdg10': 'Reduced Inequalities',
  'sdg11': 'Sustainable Cities and Communities',
  'sdg12': 'Responsible Consumption and Production',
  'sdg13': 'Climate Action',
  'sdg14': 'Life Below Water',
  'sdg15': 'Life on Land',
  'sdg16': 'Peace, Justice and Strong Institutions',
  'sdg17': 'Partnerships for the Goals',
};

const INDEXING_CATEGORY_LABELS: Record<string, string> = {
  'nature_science_lancet_cell_nejm': 'Nature/Science/The Lancet/Cell/NEJM',
  'subsidiary_if_above_20': 'Subsidiary Journals (IF > 20)',
  'scopus': 'SCOPUS',
  'scie_wos': 'SCIE/SCI (WOS)',
  'pubmed': 'PubMed',
  'naas_rating_6_plus': 'NAAS (Rating ≥ 6)',
  'abdc_scopus_wos': 'ABDC Journals (SCOPUS/WOS)',
  'sgtu_in_house': 'SGTU In-House Journal',
  'case_centre_uk': 'The Case Centre UK',
  'other_indexed': 'Other Indexed Journals',
  'non_indexed_reputed': 'Non-Indexed Reputed Journals',
};

// Helper to parse manuscript file path (can be string or JSON object)
interface ManuscriptFileInfo {
  s3Key: string;
  name: string;
  size?: number;
  mimetype?: string;
}

const parseManuscriptFilePath = (filePath: unknown): ManuscriptFileInfo | null => {
  if (!filePath) return null;
  
  // If it's already an object with s3Key
  if (typeof filePath === 'object' && filePath !== null && 's3Key' in filePath) {
    const obj = filePath as ManuscriptFileInfo;
    return {
      s3Key: obj.s3Key,
      name: obj.name || obj.s3Key.split('/').pop() || 'document',
      size: obj.size,
      mimetype: obj.mimetype
    };
  }
  
  // If it's a string, try to parse as JSON first
  if (typeof filePath === 'string') {
    try {
      const parsed = JSON.parse(filePath);
      if (parsed && typeof parsed === 'object' && 's3Key' in parsed) {
        return {
          s3Key: parsed.s3Key,
          name: parsed.name || parsed.s3Key.split('/').pop() || 'document',
          size: parsed.size,
          mimetype: parsed.mimetype
        };
      }
    } catch {
      // It's a plain string (old format: just the S3 key)
      return {
        s3Key: filePath,
        name: filePath.split('/').pop() || 'document'
      };
    }
  }
  
  return null;
};

export default function ResearchReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const { confirmDelete, confirmAction } = useConfirm();
  const id = params.id as string;
  
  const [contribution, setContribution] = useState<ResearchContribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  
  // Review form
  const [reviewComments, setReviewComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  
  // Collaborative editing state
  const [isEditMode, setIsEditMode] = useState(false);
  const [fieldSuggestions, setFieldSuggestions] = useState<FieldSuggestion[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempSuggestion, setTempSuggestion] = useState<Partial<FieldSuggestion>>({});
  const [showSuggestionsPreview, setShowSuggestionsPreview] = useState(false);

  // Research Progress Tracker state
  const [trackerHistory, setTrackerHistory] = useState<ResearchProgressTracker[]>([]);
  const [trackerHistoryLoading, setTrackerHistoryLoading] = useState(false);
  const [showTrackerHistory, setShowTrackerHistory] = useState(false);

  useEffect(() => {
    if (id) {
      fetchContribution();
      fetchTrackerHistory();
    }
    if (user?.id) {
      fetchUserPermissions();
    }
  }, [id, user]);

  const fetchUserPermissions = async () => {
    try {
      const response = await permissionManagementService.getUserPermissions(user!.id);
      const drdPermissions: Record<string, boolean> = {};
      response.data.centralDepartments.forEach(dept => {
        if (dept.centralDept.departmentCode === 'DRD') {
          Object.assign(drdPermissions, dept.permissions);
        }
      });
      setUserPermissions(drdPermissions);
    } catch (error: unknown) {
      logger.error('Error fetching permissions:', error);
    }
  };

  const fetchContribution = async () => {
    try {
      setLoading(true);
      const response = await researchService.getContributionById(id);
      setContribution(response.data);
    } catch (error: unknown) {
      logger.error('Error fetching contribution:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackerHistory = async () => {
    try {
      setTrackerHistoryLoading(true);
      const response = await progressTrackerService.getTrackerHistoryForContribution(id);
      if (response.data?.trackers) {
        setTrackerHistory(response.data.trackers);
      }
    } catch (error: unknown) {
      logger.error('Error fetching tracker history:', error);
      // Silently fail - tracker history is optional
    } finally {
      setTrackerHistoryLoading(false);
    }
  };

  const handleStartReview = async () => {
    try {
      setActionLoading(true);
      await researchService.startReview(id);
      fetchContribution();
    } catch (error: unknown) {
      logger.error('Error starting review:', error);
      addToast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to get the correct permission based on publication type
  const getApprovePermission = () => {
    if (!contribution) return false;
    switch (contribution.publicationType) {
      case 'conference_paper':
        return userPermissions.conference_approve;
      case 'book':
      case 'book_chapter':
        return userPermissions.book_approve;
      case 'research_paper':
      default:
        return userPermissions.research_approve;
    }
  };

  const getReviewPermission = () => {
    if (!contribution) return false;
    switch (contribution.publicationType) {
      case 'conference_paper':
        return userPermissions.conference_review || userPermissions.conference_approve;
      case 'book':
      case 'book_chapter':
        return userPermissions.book_review || userPermissions.book_approve;
      case 'research_paper':
      default:
        return userPermissions.research_review || userPermissions.research_approve;
    }
  };

  const handleApprove = async () => {
    const hasApprovePermission = getApprovePermission();
    const actionText = hasApprovePermission ? 'Approve' : 'Recommend for Approval';
    const confirmText = hasApprovePermission 
      ? 'Approve this research contribution? Incentives will be credited to all authors.'
      : 'Recommend this contribution for final approval? It will be sent to the approver for review.';
    
    const confirmed = await confirmAction('Confirm Submission', confirmText);
    if (!confirmed) return;
    
    try {
      setActionLoading(true);
      
      if (hasApprovePermission) {
        // Final approval
        await researchService.approveContribution(id, { comments: reviewComments });
        addToast({ type: 'success', message: 'Contribution approved successfully!' });
      } else {
        // Recommend for approval
        await researchService.recommendForApproval(id, { comments: reviewComments });
        addToast({ type: 'success', message: 'Contribution recommended for approval successfully!' });
      }
      
      router.push('/drd/research');
    } catch (error: unknown) {
      logger.error(`Error ${hasApprovePermission ? 'approving' : 'recommending'} contribution:`, error);
      addToast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!reviewComments.trim() && fieldSuggestions.length === 0) {
      addToast({ type: 'warning', message: 'Please provide comments or field suggestions for the changes required' });
      return;
    }
    
    try {
      setActionLoading(true);
      await researchService.requestChanges(id, { 
        comments: reviewComments,
        suggestions: fieldSuggestions.map(s => ({
          fieldName: s.fieldName,
          fieldPath: s.fieldPath,
          originalValue: s.originalValue,
          suggestedValue: s.suggestedValue,
          note: s.note
        }))
      });
      setShowChangesModal(false);
      setReviewComments('');
      setFieldSuggestions([]);
      setIsEditMode(false);
      fetchContribution();
    } catch (error: unknown) {
      logger.error('Error requesting changes:', error);
      addToast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      addToast({ type: 'warning', message: 'Please provide a reason for rejection' });
      return;
    }
    
    try {
      setActionLoading(true);
      await researchService.rejectContribution(id, { reason: rejectReason });
      addToast({ type: 'success', message: 'Contribution rejected' });
      router.push('/drd/research');
    } catch (error: unknown) {
      logger.error('Error rejecting contribution:', error);
      addToast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================
  // Collaborative Editing Functions
  // ============================================

  const getFieldValue = (fieldName: string): string => {
    if (!contribution) return '';
    const value = (contribution as any)[fieldName];
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(','); // Handle array values for multiselect
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    return String(value);
  };

  const getFieldLabel = (fieldName: string): string => {
    const field = EDITABLE_FIELDS.find(f => f.key === fieldName);
    return field?.label || fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const startEditingField = (fieldName: string) => {
    const originalValue = getFieldValue(fieldName);
    setEditingField(fieldName);
    setTempSuggestion({
      fieldName,
      originalValue,
      suggestedValue: originalValue,
      note: ''
    });
  };

  const cancelEditingField = () => {
    setEditingField(null);
    setTempSuggestion({});
  };

  const saveFieldSuggestion = () => {
    if (!tempSuggestion.fieldName || !tempSuggestion.suggestedValue) return;
    
    // Check if suggestion already exists for this field
    const existingIndex = fieldSuggestions.findIndex(s => s.fieldName === tempSuggestion.fieldName);
    
    const newSuggestion: FieldSuggestion = {
      fieldName: tempSuggestion.fieldName,
      originalValue: tempSuggestion.originalValue || '',
      suggestedValue: tempSuggestion.suggestedValue,
      note: tempSuggestion.note
    };
    
    if (existingIndex >= 0) {
      const updated = [...fieldSuggestions];
      updated[existingIndex] = newSuggestion;
      setFieldSuggestions(updated);
    } else {
      setFieldSuggestions([...fieldSuggestions, newSuggestion]);
    }
    
    setEditingField(null);
    setTempSuggestion({});
  };

  const removeSuggestion = (fieldName: string) => {
    setFieldSuggestions(fieldSuggestions.filter(s => s.fieldName !== fieldName));
  };

  const hasSuggestionForField = (fieldName: string): boolean => {
    return fieldSuggestions.some(s => s.fieldName === fieldName);
  };

  const getSuggestionForField = (fieldName: string): FieldSuggestion | undefined => {
    return fieldSuggestions.find(s => s.fieldName === fieldName);
  };

  // Render editable field with suggestion capability
  const renderEditableField = (fieldName: string, displayValue: string | React.ReactNode, type: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'multiselect' = 'text', options?: string[]) => {
    const isEditing = editingField === fieldName;
    const hasSuggestion = hasSuggestionForField(fieldName);
    const suggestion = getSuggestionForField(fieldName);
    
    if (!isEditMode) {
      return (
        <div className="font-medium">
          {hasSuggestion ? (
            <div className="space-y-1">
              <span className="line-through text-gray-400">{displayValue}</span>
              <span className="block text-green-600 font-semibold">{suggestion?.suggestedValue}</span>
              {suggestion?.note && (
                <span className="block text-xs text-gray-500 italic">Note: {suggestion.note}</span>
              )}
            </div>
          ) : (
            displayValue
          )}
        </div>
      );
    }
    
    if (isEditing) {
      return (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">Original: {tempSuggestion.originalValue || 'N/A'}</div>
          {type === 'textarea' ? (
            <textarea
              value={tempSuggestion.suggestedValue || ''}
              onChange={(e) => setTempSuggestion({ ...tempSuggestion, suggestedValue: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              rows={3}
            />
          ) : type === 'multiselect' && options ? (
            <div className="grid grid-cols-2 gap-2 p-3 bg-white border border-blue-300 rounded-lg">
              {options.map(opt => {
                const currentValues = (tempSuggestion.suggestedValue || '').split(',').map((v: string) => v.trim()).filter(Boolean);
                const isChecked = currentValues.includes(opt);
                return (
                  <label key={opt} className="flex items-start space-x-2 p-2 rounded hover:bg-blue-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const values = (tempSuggestion.suggestedValue || '').split(',').map((v: string) => v.trim()).filter(Boolean);
                        const newValues = e.target.checked 
                          ? [...values, opt]
                          : values.filter(v => v !== opt);
                        setTempSuggestion({ ...tempSuggestion, suggestedValue: newValues.join(',') });
                      }}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{INDEXING_CATEGORY_LABELS[opt] || opt}</span>
                  </label>
                );
              })}
            </div>
          ) : type === 'select' && options ? (
            <select
              value={tempSuggestion.suggestedValue || ''}
              onChange={(e) => setTempSuggestion({ ...tempSuggestion, suggestedValue: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {options.map(opt => (
                <option key={opt} value={opt}>{opt.toUpperCase()}</option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={tempSuggestion.suggestedValue || ''}
              onChange={(e) => setTempSuggestion({ ...tempSuggestion, suggestedValue: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          )}
          <input
            type="text"
            placeholder="Add a note (optional)"
            value={tempSuggestion.note || ''}
            onChange={(e) => setTempSuggestion({ ...tempSuggestion, note: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={saveFieldSuggestion}
              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
            >
              <CheckCircle className="w-3 h-3 inline mr-1" />
              Save
            </button>
            <button
              onClick={cancelEditingField}
              className="px-3 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex items-start justify-between group hover:bg-blue-50 rounded-lg p-2 -m-2 transition-colors">
        <div className="font-medium flex-1">
          {hasSuggestion ? (
            <div className="space-y-1">
              <span className="line-through text-gray-400">{displayValue}</span>
              <span className="block text-green-600 font-semibold">{suggestion?.suggestedValue}</span>
              {suggestion?.note && (
                <span className="block text-xs text-gray-500 italic">Note: {suggestion.note}</span>
              )}
            </div>
          ) : (
            <span>{displayValue || <span className="text-gray-400 italic">Not provided</span>}</span>
          )}
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          <button
            onClick={() => startEditingField(fieldName)}
            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg border border-blue-300 bg-blue-50 transition-all"
            title="Suggest change"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          {hasSuggestion && (
            <button
              onClick={() => removeSuggestion(fieldName)}
              className="p-2 text-red-600 hover:bg-red-100 rounded-lg border border-red-300 bg-red-50"
              title="Remove suggestion"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!contribution) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Contribution not found</h2>
          <Link href="/drd/research" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[contribution.status] || STATUS_CONFIG.submitted;
  const StatusIcon = statusConfig.icon;
  const pubTypeConfig = PUBLICATION_TYPE_CONFIG[contribution.publicationType];
  const PubTypeIcon = pubTypeConfig?.icon || FileText;

  // Check if current user recommended this contribution
  const userRecommendedThis = contribution.reviews?.some(
    (review: any) => review.reviewerId === user?.id && review.decision === 'recommended'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link
            href="/drd/research"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 ${pubTypeConfig?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center`}>
                <PubTypeIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                {isEditMode ? (
                  <div className="group">
                    {renderEditableField('title', contribution.title, 'text')}
                  </div>
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900">{contribution.title}</h1>
                )}
                <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                  <span>{contribution.applicationNumber}</span>
                  <span>•</span>
                  <span>{pubTypeConfig?.label || contribution.publicationType}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Edit Mode Toggle - Show when under review */}
              {['under_review', 'resubmitted'].includes(contribution.status) && (
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isEditMode 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  {isEditMode ? 'Exit Edit Mode' : 'Suggest Changes'}
                </button>
              )}
              
              {/* User Recommended Badge */}
              {userRecommendedThis && (
                <div className="flex items-center px-3 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  You Recommended
                </div>
              )}
              
              <div className={`flex items-center px-4 py-2 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                <StatusIcon className="w-4 h-4 mr-2" />
                {statusConfig.label}
              </div>
            </div>
          </div>
          
          {/* Edit Mode Banner */}
          {isEditMode && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Edit3 className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-800">Collaborative Edit Mode Active</span>
                  <span className="ml-2 text-blue-600">
                    ({fieldSuggestions.length} suggestion{fieldSuggestions.length !== 1 ? 's' : ''} pending)
                  </span>
                </div>
                <div className="flex gap-2">
                  {fieldSuggestions.length > 0 && (
                    <button
                      onClick={() => setShowSuggestionsPreview(true)}
                      className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Preview & Submit
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-blue-700 mt-2">
                Hover over any field and click the edit icon to suggest changes. Your suggestions will be sent to the applicant for review.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Applicant Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Applicant Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Applicant</div>
                <div className="font-medium">{contribution.applicantUser?.employeeDetails?.displayName || contribution.applicantUser?.email}</div>
              </div>
            </div>
            {contribution.school && (
              <div className="flex items-center space-x-3">
                <Building className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">School</div>
                  <div className="font-medium">{contribution.school.facultyName || contribution.school.shortName}</div>
                </div>
              </div>
            )}
            {contribution.department && (
              <div className="flex items-center space-x-3">
                <Building className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Department</div>
                  <div className="font-medium">{contribution.department.departmentName}</div>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Submitted On</div>
                <div className="font-medium">
                  {contribution.submittedAt ? new Date(contribution.submittedAt).toLocaleDateString() : 'Not submitted'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Publication Details */}
        <div className={`bg-white rounded-xl shadow-sm border ${isEditMode ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {contribution.publicationType === 'research_paper' ? 'Journal Details' :
               contribution.publicationType === 'book' ? 'Book Details' :
               contribution.publicationType === 'book_chapter' ? 'Book Chapter Details' :
               contribution.publicationType === 'conference_paper' ? 'Conference Details' :
               contribution.publicationType === 'grant_proposal' ? 'Grant Details' :
               'Publication Details'}
            </h2>
            {isEditMode && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Click edit icon on any field to suggest changes
              </span>
            )}
          </div>
          
          {contribution.abstract && (
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-1">Abstract</div>
              {renderEditableField('abstract', contribution.abstract, 'textarea')}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contribution.publishedYear && (
              <div>
                <div className="text-sm text-gray-500">Published Year</div>
                {renderEditableField('publishedYear', contribution.publishedYear, 'number')}
              </div>
            )}
            
            {/* Book and Book Chapter specific */}
            {(contribution.publicationType === 'book' || contribution.publicationType === 'book_chapter') && (
              <>
                {((contribution as any).publisherName || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Publisher</div>
                    {renderEditableField('publisherName', (contribution as any).publisherName || '', 'text')}
                  </div>
                )}
                {((contribution as any).isbn || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">ISBN</div>
                    {renderEditableField('isbn', (contribution as any).isbn || '', 'text')}
                  </div>
                )}
                {((contribution as any).publicationDate || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Publication Date</div>
                    {renderEditableField('publicationDate', (contribution as any).publicationDate ? new Date((contribution as any).publicationDate).toISOString().split('T')[0] : '', 'date')}
                  </div>
                )}
                {((contribution as any).nationalInternational || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">National/International</div>
                    {renderEditableField('nationalInternational', (contribution as any).nationalInternational || '', 'select', ['national', 'international'])}
                  </div>
                )}
                {((contribution as any).bookPublicationType || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Author Type</div>
                    {renderEditableField('bookPublicationType', (contribution as any).bookPublicationType || '', 'select', ['authored', 'edited'])}
                  </div>
                )}
                {((contribution as any).bookIndexingType || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Publication Type</div>
                    {renderEditableField('bookIndexingType', (contribution as any).bookIndexingType || '', 'select', ['scopus_indexed', 'non_indexed', 'sgt_publication_house'])}
                  </div>
                )}
                {((contribution as any).bookLetter || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Our Authorized Publications</div>
                    <div className="font-medium capitalize">{(contribution as any).bookLetter}</div>
                  </div>
                )}
                {(((contribution as any).interdisciplinaryFromSgt !== undefined && (contribution as any).interdisciplinaryFromSgt !== null) || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Interdisciplinary (SGT)</div>
                    {isEditMode ? (
                      renderEditableField('interdisciplinaryFromSgt', (contribution as any).interdisciplinaryFromSgt ? 'yes' : 'no', 'select', ['yes', 'no'])
                    ) : (
                      <div className="font-medium capitalize">{(contribution as any).interdisciplinaryFromSgt ? 'yes' : 'no'}</div>
                    )}
                  </div>
                )}
                <div>
                  <div className="text-sm text-gray-500">Communicated with Official ID</div>
                  {isEditMode ? (
                    renderEditableField('communicatedWithOfficialId', 
                      (contribution as any).communicatedWithOfficialId === true ? 'yes' : 
                      (contribution as any).communicatedWithOfficialId === false ? 'no' : 
                      (contribution as any).communicatedWithOfficialId || '', 
                      'select', ['yes', 'no'])
                  ) : (
                    <div className="font-medium capitalize">
                      {(contribution as any).communicatedWithOfficialId === true ? 'Yes' : 
                       (contribution as any).communicatedWithOfficialId === false ? 'No' : 
                       'Not provided'}
                    </div>
                  )}
                </div>
                {((contribution as any).communicatedWithOfficialId === false || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Personal Email</div>
                    {isEditMode ? (
                      renderEditableField('personalEmail', (contribution as any).personalEmail || '', 'text')
                    ) : (
                      <div className="font-medium">{(contribution as any).personalEmail || 'Not provided'}</div>
                    )}
                  </div>
                )}
                {contribution.publicationType === 'book_chapter' && (
                  <>
                    {((contribution as any).bookTitle || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Book Title</div>
                        {renderEditableField('bookTitle', (contribution as any).bookTitle || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).chapterNumber || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Chapter Number</div>
                        {renderEditableField('chapterNumber', (contribution as any).chapterNumber || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).editors || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Editors</div>
                        {renderEditableField('editors', (contribution as any).editors || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).pageNumbers || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Page Numbers</div>
                        {renderEditableField('pageNumbers', (contribution as any).pageNumbers || '', 'text')}
                      </div>
                    )}
                  </>
                )}
                {((contribution as any).facultyRemarks || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Faculty Remarks</div>
                    <div className="font-medium">{(contribution as any).facultyRemarks || 'None'}</div>
                  </div>
                )}
              </>
            )}

            {/* Research Paper specific */}
            {contribution.publicationType === 'research_paper' && (
              <>
                {(contribution.doi || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">DOI</div>
                    {isEditMode ? (
                      renderEditableField('doi', contribution.doi || '', 'text')
                    ) : (
                      <a href={`https://doi.org/${contribution.doi}`} target="_blank" rel="noopener noreferrer" 
                         className="font-medium text-blue-600 hover:underline flex items-center">
                        {contribution.doi}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                  </div>
                )}
                {(contribution.journalName || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Journal Name</div>
                    {renderEditableField('journalName', contribution.journalName || '', 'text')}
                  </div>
                )}
                {((contribution as any).volume || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Volume</div>
                    {renderEditableField('volume', (contribution as any).volume || '', 'text')}
                  </div>
                )}
                {((contribution as any).issue || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Issue</div>
                    {renderEditableField('issue', (contribution as any).issue || '', 'text')}
                  </div>
                )}
                {((contribution as any).pageNumbers || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Page Numbers</div>
                    {renderEditableField('pageNumbers', (contribution as any).pageNumbers || '', 'text')}
                  </div>
                )}
                {((contribution as any).issn || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">ISSN</div>
                    {renderEditableField('issn', (contribution as any).issn || '', 'text')}
                  </div>
                )}
                {(contribution as any).publisherName && (
                  <div>
                    <div className="text-sm text-gray-500">Weblink</div>
                    {isEditMode ? (
                      renderEditableField('publisherName', (contribution as any).publisherName || '', 'text')
                    ) : (
                      <a href={(contribution as any).publisherName} target="_blank" rel="noopener noreferrer" 
                         className="font-medium text-blue-600 hover:underline flex items-center">
                        {(contribution as any).publisherName}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                  </div>
                )}
                {((contribution as any).publicationDate || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Publication Date</div>
                    {renderEditableField('publicationDate', (contribution as any).publicationDate ? new Date((contribution as any).publicationDate).toISOString().split('T')[0] : '', 'date')}
                  </div>
                )}
                {((contribution as any).publicationStatus || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Publication Status</div>
                    {renderEditableField('publicationStatus', (contribution as any).publicationStatus || '', 'select', ['published', 'in_press', 'accepted', 'under_review'])}
                  </div>
                )}
                {(contribution.impactFactor || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Impact Factor</div>
                    {renderEditableField('impactFactor', contribution.impactFactor?.toString() || '', 'number')}
                  </div>
                )}
                {((contribution as any).subsidiaryImpactFactor || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Subsidiary Impact Factor</div>
                    {renderEditableField('subsidiaryImpactFactor', (contribution as any).subsidiaryImpactFactor?.toString() || '', 'number')}
                  </div>
                )}
                {(contribution.sjr || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">SJR</div>
                    {renderEditableField('sjr', contribution.sjr?.toString() || '', 'number')}
                  </div>
                )}
                {((contribution as any).naasRating || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">NAAS Rating</div>
                    {renderEditableField('naasRating', (contribution as any).naasRating?.toString() || '', 'number')}
                  </div>
                )}
                {((contribution as any).quartile || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Quartile</div>
                    {renderEditableField('quartile', formatQuartile((contribution as any).quartile) || '', 'select', ['Top 1%', 'Top 5%', 'Q1', 'Q2', 'Q3', 'Q4'])}
                  </div>
                )}
                {/* Indexing Categories - Multi-select */}
                {(((contribution as any).indexingCategories && (contribution as any).indexingCategories.length > 0) || isEditMode) && (
                  <div className="col-span-full">
                    <div className="text-sm text-gray-500 mb-2">Research Indexing Categories</div>
                    {!isEditMode ? (
                      <div className="flex flex-wrap gap-2">
                        {(contribution as any).indexingCategories?.map((cat: string) => (
                          <span key={cat} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                            {INDEXING_CATEGORY_LABELS[cat] || cat}
                          </span>
                        ))}
                        {(!(contribution as any).indexingCategories || (contribution as any).indexingCategories.length === 0) && (
                          <span className="text-gray-400 italic">No indexing categories selected</span>
                        )}
                      </div>
                    ) : (
                      renderEditableField(
                        'indexingCategories',
                        <div className="flex flex-wrap gap-2">
                          {(contribution as any).indexingCategories?.map((cat: string) => (
                            <span key={cat} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                              {INDEXING_CATEGORY_LABELS[cat] || cat}
                            </span>
                          )) || <span className="text-gray-400 italic">No categories selected</span>}
                        </div>,
                        'multiselect',
                        [
                          'nature_science_lancet_cell_nejm',
                          'subsidiary_if_above_20',
                          'scopus',
                          'scie_wos',
                          'pubmed',
                          'naas_rating_6_plus',
                          'abdc_scopus_wos',
                          'sgtu_in_house',
                          'case_centre_uk',
                          'other_indexed',
                          'non_indexed_reputed'
                        ]
                      )
                    )}
                  </div>
                )}
                {(contribution.hasInternationalAuthor !== undefined) && (
                  <div>
                    <div className="text-sm text-gray-500">International Author</div>
                    <div className="font-medium flex items-center">
                      {contribution.hasInternationalAuthor ? (
                        <>
                          <Globe className="w-4 h-4 mr-1 text-green-600" />
                          Yes
                        </>
                      ) : (
                        'No'
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Conference specific */}
            {contribution.publicationType === 'conference_paper' && (
              <>
                {/* Conference Sub Type - Always show */}
                {((contribution as any).conferenceSubType || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Conference Sub Type</div>
                    {renderEditableField('conferenceSubType', (contribution as any).conferenceSubType?.replace(/_/g, ' ') || '', 'select', ['paper_indexed_scopus', 'paper_not_indexed', 'keynote_speaker_invited_talks', 'organizer_coordinator_member'])}
                  </div>
                )}
                
                {/* Common fields for all conference types */}
                {(contribution.conferenceName || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Conference Name</div>
                    {renderEditableField('conferenceName', contribution.conferenceName || '', 'text')}
                  </div>
                )}
                {(contribution.conferenceType || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">National/International</div>
                    {renderEditableField('conferenceType', contribution.conferenceType || '', 'select', ['national', 'international'])}
                  </div>
                )}
                
                {/* Fields for indexed/non-indexed papers only */}
                {['paper_indexed_scopus', 'paper_not_indexed'].includes((contribution as any).conferenceSubType) && (
                  <>
                    {((contribution as any).proceedingsTitle || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Proceedings Title</div>
                        {renderEditableField('proceedingsTitle', (contribution as any).proceedingsTitle || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).proceedingsQuartile || isEditMode) && (contribution as any).conferenceSubType === 'paper_indexed_scopus' && (
                      <div>
                        <div className="text-sm text-gray-500">Proceedings Quartile</div>
                        {renderEditableField('proceedingsQuartile', (contribution as any).proceedingsQuartile || '', 'select', ['q1', 'q2', 'q3', 'q4'])}
                      </div>
                    )}
                    {((contribution as any).indexedIn || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Indexed In</div>
                        {renderEditableField('indexedIn', (contribution as any).indexedIn?.toUpperCase() || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).conferenceHeldLocation || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Conference Held</div>
                        {renderEditableField('conferenceHeldLocation', (contribution as any).conferenceHeldLocation || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).eventCategory || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Event Category</div>
                        {renderEditableField('eventCategory', (contribution as any).eventCategory || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).totalPresenters || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Total Presenters</div>
                        {renderEditableField('totalPresenters', (contribution as any).totalPresenters?.toString() || '', 'number')}
                      </div>
                    )}
                    {((contribution as any).fullPaper !== undefined || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Full Paper</div>
                        {renderEditableField('fullPaper', (contribution as any).fullPaper === true ? 'yes' : (contribution as any).fullPaper === false ? 'no' : '', 'select', ['yes', 'no'])}
                      </div>
                    )}
                    {((contribution as any).paperDoi || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Paper DOI</div>
                        {renderEditableField('paperDoi', (contribution as any).paperDoi || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).weblink || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Weblink</div>
                        {renderEditableField('weblink', (contribution as any).weblink || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).issnIsbnIssueNo || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">ISSN/ISBN/Issue No</div>
                        {renderEditableField('issnIsbnIssueNo', (contribution as any).issnIsbnIssueNo || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).pageNumbers || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Page No</div>
                        {renderEditableField('pageNumbers', (contribution as any).pageNumbers || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).paperweblink || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Paper WebLink</div>
                        {renderEditableField('paperweblink', (contribution as any).paperweblink || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).priorityFundingArea || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Priority Funding Area</div>
                        {renderEditableField('priorityFundingArea', (contribution as any).priorityFundingArea || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).conferenceDate || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Conference Date</div>
                        {renderEditableField('conferenceDate', (contribution as any).conferenceDate ? new Date((contribution as any).conferenceDate).toISOString().split('T')[0] : '', 'date')}
                      </div>
                    )}
                    {((contribution as any).publicationDate || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Publication Date</div>
                        {renderEditableField('publicationDate', (contribution as any).publicationDate ? new Date((contribution as any).publicationDate).toISOString().split('T')[0] : '', 'date')}
                      </div>
                    )}
                    {((contribution as any).conferenceBestPaperAward !== undefined || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Best Paper Award</div>
                        {renderEditableField('conferenceBestPaperAward', (contribution as any).conferenceBestPaperAward === true ? 'yes' : (contribution as any).conferenceBestPaperAward === false ? 'no' : '', 'select', ['yes', 'no'])}
                      </div>
                    )}
                  </>
                )}
                
                {/* Fields for keynote speakers and organizers only */}
                {['keynote_speaker_invited_talks', 'organizer_coordinator_member'].includes((contribution as any).conferenceSubType) && (
                  <>
                    {((contribution as any).conferenceRole || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Conference Role</div>
                        {renderEditableField('conferenceRole', (contribution as any).conferenceRole?.replace(/_/g, ' ') || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).venue || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Venue</div>
                        {renderEditableField('venue', (contribution as any).venue || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).topic || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Topic</div>
                        {renderEditableField('topic', (contribution as any).topic || '', 'text')}
                      </div>
                    )}
                    {((contribution as any).organizerRole || isEditMode) && (
                      <div>
                        <div className="text-sm text-gray-500">Organizer Role</div>
                        {renderEditableField('organizerRole', (contribution as any).organizerRole?.replace(/_/g, ' ') || '', 'text')}
                      </div>
                    )}
                  </>
                )}
                
                {/* Optional common fields */}
                {((contribution as any).virtualConference !== undefined || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Virtual Conference</div>
                    {renderEditableField('virtualConference', (contribution as any).virtualConference === true ? 'yes' : (contribution as any).virtualConference === false ? 'no' : '', 'select', ['yes', 'no'])}
                  </div>
                )}
                {((contribution as any).conferenceHeldAtSgt !== undefined || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Held at SGT</div>
                    {renderEditableField('conferenceHeldAtSgt', (contribution as any).conferenceHeldAtSgt === true ? 'yes' : (contribution as any).conferenceHeldAtSgt === false ? 'no' : '', 'select', ['yes', 'no'])}
                  </div>
                )}
                {((contribution as any).interdisciplinaryFromSgt !== undefined || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Interdisciplinary (from SGT)</div>
                    {renderEditableField('interdisciplinaryFromSgt', (contribution as any).interdisciplinaryFromSgt === true ? 'yes' : (contribution as any).interdisciplinaryFromSgt === false ? 'no' : '', 'select', ['yes', 'no'])}
                  </div>
                )}
                {((contribution as any).studentsFromSgt !== undefined || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Student(s) (from SGT)</div>
                    {renderEditableField('studentsFromSgt', (contribution as any).studentsFromSgt === true ? 'yes' : (contribution as any).studentsFromSgt === false ? 'no' : '', 'select', ['yes', 'no'])}
                  </div>
                )}
                {((contribution as any).industryCollaboration !== undefined || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Industry Collaboration</div>
                    {renderEditableField('industryCollaboration', (contribution as any).industryCollaboration === true ? 'yes' : (contribution as any).industryCollaboration === false ? 'no' : '', 'select', ['yes', 'no'])}
                  </div>
                )}
                {((contribution as any).centralFacilityUsed !== undefined || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Central Facility Used</div>
                    {renderEditableField('centralFacilityUsed', (contribution as any).centralFacilityUsed === true ? 'yes' : (contribution as any).centralFacilityUsed === false ? 'no' : '', 'select', ['yes', 'no'])}
                  </div>
                )}
                {((contribution as any).communicatedWithOfficialId !== undefined || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Communicated with Official ID</div>
                    {renderEditableField('communicatedWithOfficialId', (contribution as any).communicatedWithOfficialId === true ? 'yes' : (contribution as any).communicatedWithOfficialId === false ? 'no' : '', 'select', ['yes', 'no'])}
                  </div>
                )}
                {((contribution as any).facultyRemarks || isEditMode) && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <div className="text-sm text-gray-500">Faculty Remarks</div>
                    {renderEditableField('facultyRemarks', (contribution as any).facultyRemarks || '', 'textarea')}
                  </div>
                )}
              </>
            )}
            
            {/* Grant specific */}
            {contribution.publicationType === 'grant_proposal' && (
              <>
                {(contribution.grantTitle || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Grant Title</div>
                    {renderEditableField('grantTitle', contribution.grantTitle || '', 'text')}
                  </div>
                )}
                {(contribution.fundingAgency || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Funding Agency</div>
                    {renderEditableField('fundingAgency', contribution.fundingAgency || '', 'text')}
                  </div>
                )}
                {(contribution.grantAmount || isEditMode) && (
                  <div>
                    <div className="text-sm text-gray-500">Grant Amount</div>
                    {renderEditableField('grantAmount', contribution.grantAmount ? `₹${contribution.grantAmount.toLocaleString()}` : '', 'number')}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Authors */}
        <div className={`bg-white rounded-xl shadow-sm border ${isEditMode ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Authors ({contribution.authors?.length || 0})</h2>
            {isEditMode && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                Author information cannot be edited
              </span>
            )}
          </div>
          <div className="space-y-3">
            {contribution.authors?.map((author, index) => (
              <div key={author.id || index} className={`flex items-center justify-between p-3 rounded-lg ${isEditMode ? 'bg-gray-50' : 'bg-gray-50'}`}>
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{author.name}</div>
                    <div className="text-sm text-gray-500">
                      {contribution.publicationType === 'book' || contribution.publicationType === 'book_chapter' ? (
                        <span>{author.affiliation || (author.userId ? 'SGT University' : 'External')}</span>
                      ) : (
                        <>
                          {author.authorType?.replace(/_/g, ' ')} • {author.authorRole?.replace(/_/g, ' ')}
                          {author.isCorresponding && ' • Corresponding'}
                        </>
                      )}
                    </div>
                    {/* Display incentives for internal authors */}
                    {(author.userId || author.authorType?.startsWith('internal_') || author.authorCategory === 'Internal') && (
                      <div className="flex items-center gap-4 mt-1 text-xs">
                        <span className="text-green-600 font-medium">
                          Incentive: ₹{author.incentiveShare ? Number(author.incentiveShare).toLocaleString() : '0'}
                        </span>
                        {author.authorType !== 'internal_student' && (
                          <span className="text-blue-600 font-medium">
                            Points: {author.pointsShare ? Number(author.pointsShare).toLocaleString() : '0'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {author.userId && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Internal</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SDG Goals */}
        {(contribution as any).sdg_goals && (
          <div className={`bg-white rounded-xl shadow-sm border ${isEditMode ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Award className="w-5 h-5 mr-2 text-green-600" />
                UN Sustainable Development Goals (SDGs)
              </h2>
              {isEditMode && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  Click edit icon to suggest SDG changes
                </span>
              )}
            </div>
            {isEditMode ? (
              <div>
                {renderEditableField('sdg_goals', 
                  Array.isArray((contribution as any).sdg_goals) 
                    ? (contribution as any).sdg_goals.join(', ') 
                    : (contribution as any).sdg_goals || '', 
                  'text')}
                <p className="text-xs text-gray-500 mt-2">Enter SDG goals separated by commas (e.g., sdg1, sdg2, sdg4)</p>
              </div>
            ) : (
              <div>
                {/* Display SDG Goals in grid format like the form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {Object.entries(SDG_LABELS).map(([key, label]) => {
                    const selectedGoals = Array.isArray((contribution as any).sdg_goals) 
                      ? (contribution as any).sdg_goals.map((s: string) => s.trim().toLowerCase())
                      : ((contribution as any).sdg_goals || '').split(',').map((s: string) => s.trim().toLowerCase()).filter((s: string) => s);
                    const isSelected = selectedGoals.includes(key);
                    
                    return (
                      <div 
                        key={key} 
                        className={`flex items-center space-x-3 px-4 py-3 rounded-lg border-2 transition-all ${
                          isSelected 
                            ? 'bg-green-50 border-green-500' 
                            : 'bg-gray-50 border-gray-200 opacity-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-green-500' : 'bg-gray-300'
                        }`}>
                          {isSelected && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span className={`text-sm font-medium ${
                          isSelected ? 'text-green-900' : 'text-gray-500'
                        }`}>
                          {formatSDG(key)}: {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Faculty Remarks */}
        {(contribution as any).facultyRemarks && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-gray-600" />
              Faculty Remarks
            </h2>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700 whitespace-pre-wrap">{(contribution as any).facultyRemarks}</p>
            </div>
          </div>
        )}

        {/* Documents */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            Submitted Documents
          </h2>
          <div className="space-y-3">
            {contribution.manuscriptFilePath ? (() => {
              const manuscriptInfo = parseManuscriptFilePath(contribution.manuscriptFilePath);
              return manuscriptInfo ? (
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <div>
                      <div className="font-medium text-gray-900">Research Document</div>
                      <div className="text-sm text-gray-500">{manuscriptInfo.name}</div>
                    </div>
                  </div>
                  <a
                    href={getResearchDocumentDownloadUrl(contribution.id, 'manuscript', manuscriptInfo.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View
                  </a>
                </div>
              ) : null;
            })() : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No research document uploaded</p>
              </div>
            )}

            {contribution.supportingDocsFilePaths && (contribution.supportingDocsFilePaths as any).files?.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 mt-4">Supporting Documents</h3>
                {((contribution.supportingDocsFilePaths as any).files as Array<{path: string, s3Key?: string, name: string, size?: number}>).map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{doc.name}</div>
                        {doc.size && (
                          <div className="text-xs text-gray-500">
                            {(doc.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        )}
                      </div>
                    </div>
                    <a
                      href={getResearchDocumentDownloadUrl(contribution.id, 'supporting', doc.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View
                    </a>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Incentive Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Incentive Calculation</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2 text-green-700 mb-1">
                <Coins className="w-5 h-5" />
                <span className="text-sm font-medium">Calculated Incentive</span>
              </div>
              <div className="text-2xl font-bold text-green-700">
                ₹{(contribution.calculatedIncentiveAmount || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-2 text-purple-700 mb-1">
                <Award className="w-5 h-5" />
                <span className="text-sm font-medium">Calculated Points</span>
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {contribution.calculatedPoints || 0}
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Distribution Rules:</strong> Single author gets 100%. Exactly 2 authors (no co-authors) split 50-50. 
              Same person = First + Corresponding gets both percentages combined. 
              Internal Faculty/Employees receive both incentives and points. 
              Internal Students receive incentives only (no points). 
              External authors receive neither (their co-author share goes to internal co-authors, 
              but first/corresponding author share is forfeited).
            </p>
          </div>
        </div>

        {/* Research Progress Tracker History */}
        {trackerHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">Research Progress History</h2>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                  {trackerHistory.length} tracker{trackerHistory.length > 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => setShowTrackerHistory(!showTrackerHistory)}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {showTrackerHistory ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            
            <div className="text-sm text-gray-600 mb-4">
              This contribution has been tracked through the Research Progress Tracker. 
              View the complete journey from writing to publication.
            </div>
            
            {showTrackerHistory && (
              <div className="space-y-6">
                {trackerHistory.map((tracker) => (
                  <div key={tracker.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <GitBranch className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{tracker.title}</span>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[tracker.currentStatus]}`}>
                          {statusLabels[tracker.currentStatus]}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Started: {new Date(tracker.createdAt).toLocaleDateString()} | 
                        Last Updated: {new Date(tracker.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {/* Timeline of status changes */}
                    {tracker.statusHistory && tracker.statusHistory.length > 0 && (
                      <div className="px-4 py-3">
                        <div className="relative">
                          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                          <div className="space-y-4">
                            {tracker.statusHistory.map((history, idx) => (
                              <div key={history.id} className="relative flex items-start pl-8">
                                <div className={`absolute left-1.5 w-3 h-3 rounded-full border-2 border-white ${
                                  idx === 0 ? 'bg-indigo-600' : 'bg-gray-400'
                                }`}></div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm font-medium ${
                                      idx === 0 ? 'text-indigo-700' : 'text-gray-700'
                                    }`}>
                                      {statusLabels[history.toStatus as keyof typeof statusLabels]}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(history.changedAt).toLocaleString()}
                                    </span>
                                  </div>
                                  {history.notes && (
                                    <p className="text-sm text-gray-600 mt-1">{history.notes}</p>
                                  )}
                                  {history.statusData && Object.keys(history.statusData).length > 0 && (
                                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 space-y-1">
                                      {Object.entries(history.statusData as Record<string, unknown>).map(([key, value]) => (
                                        <div key={key} className="flex">
                                          <span className="font-medium capitalize w-32">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                                          </span>
                                          <span>{String(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {!showTrackerHistory && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {trackerHistory.map((tracker) => (
                  <div key={tracker.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">{tracker.title}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[tracker.currentStatus]}`}>
                        {statusLabels[tracker.currentStatus]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {tracker.statusHistory?.length || 0} updates
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {trackerHistoryLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span className="text-gray-600">Loading research progress history...</span>
            </div>
          </div>
        )}

        {/* Review History */}
        {contribution.reviews && contribution.reviews.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Review History</h2>
            <div className="space-y-3">
              {contribution.reviews.map((review: any, index: number) => {
                const isApproval = review.decision === 'approved';
                const isRecommendation = review.decision === 'recommended';
                const isCurrentUserReview = review.reviewerId === user?.id;
                
                return (
                  <div 
                    key={review.id || index} 
                    className={`p-4 rounded-lg border-l-4 ${
                      isApproval ? 'bg-green-50 border-green-500' :
                      isRecommendation ? 'bg-blue-50 border-blue-500' :
                      review.decision === 'rejected' ? 'bg-red-50 border-red-500' :
                      review.decision === 'changes_required' ? 'bg-orange-50 border-orange-500' :
                      'bg-gray-50 border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {review.reviewer?.uid ? `${review.reviewer.uid} - ` : ''}
                          {review.reviewer?.employeeDetails?.displayName || 'Reviewer'}
                        </span>
                        {isCurrentUserReview && (
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                            You
                          </span>
                        )}
                        {isApproval && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {review.reviewedAt ? new Date(review.reviewedAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isApproval ? 'bg-green-100 text-green-700' :
                        isRecommendation ? 'bg-blue-100 text-blue-700' :
                        review.decision === 'rejected' ? 'bg-red-100 text-red-700' :
                        review.decision === 'changes_required' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {isApproval ? '✓ Final Approval' : 
                         isRecommendation ? '→ Recommended for Approval' :
                         review.decision?.replace('_', ' ').toUpperCase()}
                      </span>
                      {review.comments && (
                        <p className="mt-2 italic">{review.comments}</p>
                      )}
                      {isApproval && (
                        <div className="mt-3 p-3 bg-white rounded border border-green-200">
                          <div className="flex items-center text-green-700">
                            <Award className="w-4 h-4 mr-2" />
                            <span className="font-medium text-sm">
                              Final approval granted - Incentives credited to all internal authors
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {['submitted', 'under_review', 'resubmitted'].includes(contribution.status) && (() => {
          // Check if current user has already reviewed THIS VERSION of the contribution
          // For resubmitted contributions, allow reviewing again
          const userHasReviewed = contribution.status !== 'resubmitted' && 
            contribution.reviews?.some((review: any) => review.reviewerId === user?.id);
          
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Actions</h2>
              {userHasReviewed && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-blue-800 font-medium">You have already reviewed this contribution</span>
                  </div>
                </div>
              )}
              {!userHasReviewed && contribution.status === 'submitted' && (
                <button
                  onClick={handleStartReview}
                  disabled={actionLoading}
                  className="w-full mb-4 px-6 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Clock className="w-5 h-5 mr-2" />}
                  Start Review
                </button>
              )}
              {!userHasReviewed && ['under_review', 'resubmitted'].includes(contribution.status) && (
                <div className="space-y-4">
                  {/* Edit Mode Info */}
                  {isEditMode && fieldSuggestions.length > 0 && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-800">
                          <Edit3 className="w-4 h-4 inline mr-2" />
                          You have {fieldSuggestions.length} field suggestion(s) pending
                        </span>
                        <button
                          onClick={() => setShowSuggestionsPreview(true)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Preview & Submit
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Comments */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Review Comments</label>
                    <textarea
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add your review comments..."
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className={`flex-1 px-6 py-3 ${getApprovePermission() ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center`}
                    >
                      {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                      {getApprovePermission() ? 'Approve' : 'Recommend for Approval'}
                    </button>
                    <button
                      onClick={() => {
                        if (fieldSuggestions.length > 0) {
                          setShowSuggestionsPreview(true);
                        } else if (isEditMode) {
                          // Already in edit mode but no suggestions, show hint
                          addToast({ type: 'warning', message: 'Use the edit icons on fields above to suggest specific changes, or add comments and click "Request Changes" to send general feedback.' });
                        } else {
                          // Show the new enhanced modal
                          setShowChangesModal(true);
                        }
                      }}
                      disabled={actionLoading}
                      className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      <MessageSquare className="w-5 h-5 mr-2" />
                      Request Changes {fieldSuggestions.length > 0 && `(${fieldSuggestions.length})`}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Request Changes Modal */}
        {/* Enhanced Request Changes Modal */}
        {showChangesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Changes</h3>
              
              {/* Option to use collaborative editing */}
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <Edit3 className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-800">Want to suggest specific field changes?</h4>
                    <p className="text-sm text-blue-600 mt-1">
                      Use the collaborative editing mode to suggest precise changes to individual fields like Journal Name, Impact Factor, etc.
                    </p>
                    <button
                      onClick={() => {
                        setShowChangesModal(false);
                        setIsEditMode(true);
                      }}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Enter Collaborative Edit Mode
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-2">Or send a quick comment:</h4>
                <textarea
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                  placeholder="Describe the changes required..."
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowChangesModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestChanges}
                  disabled={actionLoading || !reviewComments.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Sending...' : 'Send Quick Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Contribution</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                placeholder="Reason for rejection..."
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions Preview Modal */}
        {showSuggestionsPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Review Your Suggestions</h3>
                <button
                  onClick={() => setShowSuggestionsPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4 mb-6">
                {fieldSuggestions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No suggestions added yet.</p>
                ) : (
                  fieldSuggestions.map((suggestion, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 mb-2">{getFieldLabel(suggestion.fieldName)}</div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Original:</span>
                              <p className="text-gray-700 line-through">{suggestion.originalValue || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Suggested:</span>
                              <p className="text-green-600 font-medium">{suggestion.suggestedValue}</p>
                            </div>
                          </div>
                          {suggestion.note && (
                            <div className="mt-2 text-sm text-gray-500 italic">
                              Note: {suggestion.note}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeSuggestion(suggestion.fieldName)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Comments (Optional)
                </label>
                <textarea
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                  placeholder="Add any additional comments for the applicant..."
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowSuggestionsPreview(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Continue Editing
                </button>
                <button
                  onClick={() => {
                    setShowSuggestionsPreview(false);
                    handleRequestChanges();
                  }}
                  disabled={actionLoading || fieldSuggestions.length === 0}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center"
                >
                  {actionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Send className="w-5 h-5 mr-2" />
                  )}
                  Submit {fieldSuggestions.length} Suggestion{fieldSuggestions.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
