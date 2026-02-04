'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { logger } from '@/shared/utils/logger';
import Link from 'next/link';
import { useAuthStore } from '@/shared/auth/authStore';
import { getFileUrl } from '@/shared/api/api';
import progressTrackerService, {
  ResearchProgressTracker,
  ResearchTrackerStatus,
  StatusHistoryEntry,
  statusLabels,
  statusColors,
  publicationTypeLabels,
  publicationTypeIcons,
} from '@/features/research-management/services/progressTracker.service';

// Import the status form components
import ResearchPaperStatusForm from '@/features/progress-tracking/components/status-forms/ResearchPaperStatusForm';
import BookStatusForm from '@/features/progress-tracking/components/status-forms/BookStatusForm';
import BookChapterStatusForm from '@/features/progress-tracking/components/status-forms/BookChapterStatusForm';
import ConferencePaperStatusForm from '@/features/progress-tracking/components/status-forms/ConferencePaperStatusForm';
import { Info } from 'lucide-react';

// 11 Indexing Categories matching ResearchContributionForm
const INDEXING_CATEGORIES = [
  { 
    value: 'nature_science_lancet_cell_nejm', 
    label: 'Nature/Science/The Lancet/Cell/NEJM',
    description: 'Top-tier journals',
    requiredFields: [] as string[]
  },
  { 
    value: 'subsidiary_if_above_20', 
    label: 'Subsidiary Journals (IF > 20)',
    description: 'High impact subsidiary journals (IF must be > 20)',
    requiredFields: ['impactFactor']
  },
  { 
    value: 'scopus', 
    label: 'SCOPUS',
    description: 'SCOPUS indexed - requires Quartile, SJR, and Impact Factor',
    requiredFields: ['quartile', 'sjr', 'impactFactor']
  },
  { 
    value: 'scie_wos', 
    label: 'SCIE/SCI (WOS)',
    description: 'Web of Science indexed',
    requiredFields: [] as string[]
  },
  { 
    value: 'pubmed', 
    label: 'PubMed',
    description: 'PubMed indexed',
    requiredFields: [] as string[]
  },
  { 
    value: 'naas_rating_6_plus', 
    label: 'NAAS (Rating ≥ 6)',
    description: 'NAAS rated journals - requires Rating ≥ 6',
    requiredFields: ['naasRating']
  },
  { 
    value: 'abdc_scopus_wos', 
    label: 'ABDC Journals (SCOPUS/WOS)',
    description: 'ABDC journals indexed in SCOPUS/WOS',
    requiredFields: [] as string[]
  },
  { 
    value: 'sgtu_in_house', 
    label: 'SGTU In-House Journal',
    description: 'SGT University in-house publications',
    requiredFields: [] as string[]
  },
  { 
    value: 'case_centre_uk', 
    label: 'The Case Centre UK',
    description: 'Case studies published in The Case Centre UK',
    requiredFields: [] as string[]
  },
];

export default function TrackerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuthStore();
  
  const [tracker, setTracker] = useState<ResearchProgressTracker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');
  
  // Editable form data
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [originalData, setOriginalData] = useState<Record<string, unknown>>({});
  
  // Document upload state
  const [uploadedDocuments, setUploadedDocuments] = useState<File[]>([]);
  const [documentNotes, setDocumentNotes] = useState('');
  
  // UI state for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    basicInfo: true,
    publicationDetails: true,
    statusFields: true,
    documents: true,  // Expanded by default to show uploads
    history: true,    // Expanded by default to show progress
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fetchTracker = async () => {
    try {
      setLoading(true);
      const response = await progressTrackerService.getTrackerById(id);
      setTracker(response.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tracker';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchTracker();
    }
  }, [id]);

  // Initialize form data when tracker loads
  useEffect(() => {
    if (tracker) {
      const typeData = tracker.publicationType === 'research_paper' ? tracker.researchPaperData :
                       tracker.publicationType === 'book' ? tracker.bookData :
                       tracker.publicationType === 'book_chapter' ? tracker.bookChapterData :
                       tracker.publicationType === 'conference_paper' ? tracker.conferencePaperData : {};
      
      // Get the latest status-specific data from ALL history entries (merged newest first)
      let mergedStatusData: Record<string, unknown> = {};
      if (tracker.statusHistory && tracker.statusHistory.length > 0) {
        // Merge all status data from oldest to newest so newest values take precedence
        const sortedHistory = [...tracker.statusHistory].reverse(); // oldest first
        sortedHistory.forEach((entry: any) => {
          if (entry.statusData && typeof entry.statusData === 'object') {
            // Handle nested initialData structure from backend
            if (entry.statusData.initialData && typeof entry.statusData.initialData === 'object') {
              mergedStatusData = { ...mergedStatusData, ...entry.statusData.initialData };
            } else {
              mergedStatusData = { ...mergedStatusData, ...entry.statusData };
            }
          }
        });
      }
      
      const initialData: Record<string, unknown> = {
        title: tracker.title,
        schoolId: user?.employeeDetails?.department?.school?.id || tracker.schoolId,
        departmentId: user?.employeeDetails?.department?.id || tracker.departmentId,
        expectedCompletionDate: tracker.expectedCompletionDate,
        notes: tracker.notes || '',
        currentStatus: tracker.currentStatus,
        ...(typeData || {}),
        ...mergedStatusData, // Merge all status history data (latest values take precedence)
      };
      
      // Backwards compatibility: Convert old targetedResearch to new indexingCategories
      if (!initialData.indexingCategories && (initialData.targetedResearch || initialData.targetedResearchType)) {
        const tr = (initialData.targetedResearch || initialData.targetedResearchType) as string;
        if (tr === 'scopus') {
          initialData.indexingCategories = ['scopus'];
        } else if (tr === 'sci_scie') {
          initialData.indexingCategories = ['scie_wos'];
        } else if (tr === 'both') {
          initialData.indexingCategories = ['scopus', 'scie_wos'];
        } else {
          initialData.indexingCategories = [];
        }
      }
      
      logger.debug('Initializing form with data:', initialData);
      logger.debug('Type data:', typeData);
      logger.debug('Merged status data:', mergedStatusData);
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [tracker]);

  const handleUpdate = async () => {
    try {
      setUpdating(true);
      setUpdateError('');
      setUpdateSuccess('');

      // Detect changes
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      Object.keys(formData).forEach(key => {
        if (JSON.stringify(formData[key]) !== JSON.stringify(originalData[key])) {
          changes[key] = { old: originalData[key], new: formData[key] };
        }
      });

      logger.debug('Changes detected:', changes);
      logger.debug('Current status in form:', formData.currentStatus);
      logger.debug('Tracker current status:', tracker?.currentStatus);

      // Allow update if there are changes OR documents to upload
      if (Object.keys(changes).length === 0 && uploadedDocuments.length === 0) {
        setUpdateError('No changes detected');
        return;
      }

      // Build update payload
      const updatePayload: any = {
        title: formData.title,
        schoolId: formData.schoolId,
        departmentId: formData.departmentId,
        expectedCompletionDate: formData.expectedCompletionDate,
        notes: formData.notes,
        currentStatus: formData.currentStatus,
      };

      // Add type-specific data
      const typeDataKey = tracker?.publicationType === 'research_paper' ? 'researchPaperData' :
                          tracker?.publicationType === 'book' ? 'bookData' :
                          tracker?.publicationType === 'book_chapter' ? 'bookChapterData' :
                          'conferencePaperData';
      
      const typeData = { ...formData };
      delete typeData.title;
      delete typeData.schoolId;
      delete typeData.departmentId;
      delete typeData.expectedCompletionDate;
      delete typeData.notes;
      delete typeData.currentStatus;
      
      updatePayload[typeDataKey] = typeData;

      logger.debug('Update payload:', updatePayload);

      // If status changed, handle status update
      if (formData.currentStatus !== tracker?.currentStatus) {
        logger.debug('Status changed, calling updateTrackerWithStatus');
        await progressTrackerService.updateTrackerWithStatus(id, {
          ...updatePayload,
          toStatus: formData.currentStatus as ResearchTrackerStatus,
          reportedDate: new Date().toISOString(),
          actualDate: new Date().toISOString(),
          notes: `Status changed from ${statusLabels[tracker!.currentStatus]} to ${statusLabels[formData.currentStatus as ResearchTrackerStatus]}. Changes: ${Object.keys(changes).join(', ')}`,
          statusData: typeData,
        });
      } else if (Object.keys(changes).length > 0 || uploadedDocuments.length > 0) {
        logger.debug('Fields/documents changed, calling single update with history');
        
        // Build comprehensive notes
        let updateNotes = '';
        if (Object.keys(changes).length > 0) {
          updateNotes = `Monthly update. Changes: ${Object.keys(changes).join(', ')}`;
        }
        if (uploadedDocuments.length > 0) {
          if (updateNotes) updateNotes += '. ';
          updateNotes += documentNotes || `${uploadedDocuments.length} document(s) uploaded`;
        }
        
        // Single update call that handles both tracker update and history entry
        await progressTrackerService.updateTrackerWithStatus(id, {
          ...updatePayload,
          toStatus: tracker!.currentStatus, // Same status
          reportedDate: new Date().toISOString(),
          actualDate: new Date().toISOString(),
          notes: updateNotes,
          statusData: typeData,
          isMonthlyReport: true,
        });
      }

      // Upload documents if any (after the main update)
      if (uploadedDocuments.length > 0) {
        const uploadFormData = new FormData();
        uploadedDocuments.forEach((file) => {
          uploadFormData.append('files', file);
        });
        if (documentNotes) {
          uploadFormData.append('notes', documentNotes);
        }
        
        await progressTrackerService.uploadAttachments(id, uploadFormData);
        setUploadedDocuments([]);
        setDocumentNotes('');
      }

      setUpdateSuccess('Tracker updated successfully!');
      await fetchTracker();
      
      // Auto-expand history section to show newly uploaded documents
      setExpandedSections(prev => ({ ...prev, history: true }));
      
      setTimeout(() => setUpdateSuccess(''), 3000);
    } catch (err: any) {
      logger.error('Update error:', err);
      logger.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update tracker';
      setUpdateError(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTypeData = () => {
    if (!tracker) return null;
    switch (tracker.publicationType) {
      case 'research_paper': return tracker.researchPaperData;
      case 'book': return tracker.bookData;
      case 'book_chapter': return tracker.bookChapterData;
      case 'conference_paper': return tracker.conferencePaperData;
      default: return null;
    }
  };

  const formatDisplayValue = (key: string, value: unknown): string | null => {
    // Skip null, undefined, empty strings, false booleans
    if (value === null || value === undefined || value === '' || (typeof value === 'boolean' && !value)) return null;
    
    // Handle booleans
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    
    // Handle arrays (like coAuthors, sdgGoals, indexingCategories)
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      // If it's an array of author objects
      if (typeof value[0] === 'object' && value[0]?.name) {
        return value.map((author: any) => {
          const category = author.authorCategory === 'Internal' ? 'Internal' : 'External';
          const role = author.authorRole || 'Co-Author';
          return `${author.name} (${category}, ${role})`;
        }).join('; ');
      }
      // SDG goals - format nicely
      if (key === 'sdgs' || key === 'sdgGoals') {
        const sdgLabels: Record<string, string> = {
          '1': 'No Poverty', '2': 'Zero Hunger', '3': 'Good Health', '4': 'Quality Education',
          '5': 'Gender Equality', '6': 'Clean Water', '7': 'Clean Energy', '8': 'Decent Work',
          '9': 'Industry Innovation', '10': 'Reduced Inequalities', '11': 'Sustainable Cities',
          '12': 'Responsible Consumption', '13': 'Climate Action', '14': 'Life Below Water',
          '15': 'Life on Land', '16': 'Peace & Justice', '17': 'Partnerships'
        };
        return value.map((v: string) => `SDG ${v}: ${sdgLabels[v] || v}`).join(', ');
      }
      // Indexing categories - format nicely
      if (key === 'indexingCategories') {
        const categoryLabels: Record<string, string> = {
          'nature_science_lancet_cell_nejm': 'Nature/Science/Lancet/Cell/NEJM',
          'subsidiary_if_above_20': 'Subsidiary Journals (IF > 20)',
          'scopus': 'SCOPUS',
          'scie_wos': 'SCIE/SCI (WOS)',
          'pubmed': 'PubMed',
          'naas_rating_6_plus': 'NAAS (Rating ≥ 6)',
          'abdc_scopus_wos': 'ABDC Journals (SCOPUS/WOS)',
          'sgtu_in_house': 'SGTU In-House Journal',
          'case_centre_uk': 'The Case Centre UK',
        };
        return value.map((v: string) => categoryLabels[v] || v).join(', ');
      }
      return value.join(', ');
    }
    
    // Handle objects
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    // Handle date strings (ISO format)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
      try {
        return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        return String(value);
      }
    }
    
    // Handle enum-like values
    const enumMappings: Record<string, Record<string, string>> = {
      userRole: { 
        'first_and_corresponding': 'First & Corresponding Author',
        'first': 'First Author',
        'corresponding': 'Corresponding Author',
        'co_author': 'Co-Author'
      },
      authorType: {
        'Faculty': 'Faculty',
        'Student': 'Student',
        'Research Scholar': 'Research Scholar'
      },
      authorRole: {
        'first_and_corresponding': 'First & Corresponding',
        'first': 'First Author',
        'corresponding': 'Corresponding',
        'co_author': 'Co-Author'
      },
      bookIndexingType: { scopus_indexed: 'Scopus Indexed', non_indexed: 'Non-Indexed', sgt_publication_house: 'SGT Publication House' },
      bookPublicationType: { authored: 'Authored', edited: 'Edited' },
      nationalInternational: { national: 'National', international: 'International' },
      conferenceType: { national: 'National', international: 'International', regional: 'Regional' },
      conferenceSubType: { paper_not_indexed: 'Paper (Not Indexed)', paper_indexed_scopus: 'Paper (Scopus Indexed)', keynote_speaker_invited_talks: 'Keynote/Invited Talk', organizer_coordinator_member: 'Organizer/Coordinator' },
      proceedingsQuartile: { q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4', na: 'N/A' },
      interdisciplinary: { yes: 'Yes', no: 'No' },
      hasLpuStudents: { yes: 'Yes', no: 'No' },
      hasInternationalAuthor: { yes: 'Yes', no: 'No' },
      industryCollaboration: { yes: 'Yes', no: 'No' },
      communicatedWithOfficialId: { yes: 'Yes', no: 'No' },
      centralFacilityUsed: { yes: 'Yes', no: 'No' },
      bookLetter: { yes: 'Yes', no: 'No' },
      isPresenter: { yes: 'Yes', no: 'No' },
      virtualConference: { yes: 'Yes', no: 'No' },
      conferenceHeldAtSgt: { yes: 'Yes', no: 'No' },
      conferenceBestPaperAward: { yes: 'Yes', no: 'No' },
    };
    
    if (enumMappings[key] && typeof value === 'string') {
      return enumMappings[key][value] || String(value);
    }
    
    // Handle strings and numbers
    return String(value);
  };

  // Helper function to format field labels
  const formatFieldLabel = (key: string): string => {
    const labelMappings: Record<string, string> = {
      sjr: 'SJR',
      sdgs: 'UN SDGs',
      quartile: 'Quartile',
      userRole: 'User Role',
      coAuthors: 'Co-Authors',
      naasRating: 'NAAS Rating',
      sgtAuthors: 'SGT Authors',
      impactFactor: 'Impact Factor',
      manuscriptId: 'Manuscript ID',
      totalAuthors: 'Total Authors',
      progressNotes: 'Progress Notes',
      hasLpuStudents: 'Has LPU Students',
      journalDetails: 'Journal Details',
      journalName: 'Journal Name',
      communicationDate: 'Communication Date',
      interdisciplinary: 'Interdisciplinary',
      internalCoAuthors: 'Internal Co-Authors',
      indexingCategories: 'Indexing Categories',
      hasInternationalAuthor: 'Has International Author',
      communicatedWithOfficialId: 'Communicated with Official ID',
      volume: 'Volume',
      issue: 'Issue',
      pageNumbers: 'Pages',
      doi: 'DOI',
      issn: 'ISSN',
      weblink: 'Publication URL',
      publicationUrl: 'Publication URL',
      publicationWeblink: 'Publication URL',
      publicationDate: 'Publication Date',
    };
    
    return labelMappings[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !tracker) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800">{error || 'Tracker not found'}</p>
          <Link href="/research/progress-tracker" className="text-indigo-600 hover:underline mt-2 inline-block">
            Back to Trackers
          </Link>
        </div>
      </div>
    );
  }

  // Check if tracker is locked (cannot be edited after rejected or published)
  const isLocked = tracker.currentStatus === 'rejected' || tracker.currentStatus === 'published';

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/research/progress-tracker"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Trackers
        </Link>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header Section */}
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{publicationTypeIcons[tracker.publicationType]}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[tracker.currentStatus]}`}>
                  {statusLabels[tracker.currentStatus]}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{tracker.title}</h1>
              <p className="text-gray-600">
                {publicationTypeLabels[tracker.publicationType]}
                <span className="mx-2">•</span>
                <span className="font-mono text-sm">{tracker.trackingNumber}</span>
              </p>
              {tracker.school && (
                <p className="text-sm text-gray-500 mt-1">
                  {tracker.school.name}
                  {tracker.department && ` • ${tracker.department.name}`}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {tracker.currentStatus === 'published' && !tracker.researchContributionId && (
                <Link
                  href={`/research/apply?type=${tracker.publicationType}&trackerId=${tracker.id}`}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-center"
                >
                  File for Incentive
                </Link>
              )}
              {tracker.researchContributionId && (
                <Link
                  href={`/research/contribution/${tracker.researchContributionId}`}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-center"
                >
                  View Incentive Claim
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            {['writing', 'communicated', 'submitted', 'accepted', 'published'].map((status, idx) => {
              const statusOrder = ['writing', 'communicated', 'submitted', 'accepted', 'published'];
              const currentIndex = statusOrder.indexOf(tracker.currentStatus);
              const thisIndex = idx;
              const isComplete = thisIndex <= currentIndex && tracker.currentStatus !== 'rejected';
              const isCurrent = status === tracker.currentStatus;
              const isRejected = tracker.currentStatus === 'rejected';
              
              return (
                <div 
                  key={status} 
                  className={`text-center flex-1 ${isComplete ? 'text-indigo-600 font-medium' : ''} ${isCurrent ? 'font-bold text-indigo-700' : ''} ${isRejected && status === tracker.currentStatus ? 'text-red-600 font-bold' : ''}`}
                >
                  {statusLabels[status as ResearchTrackerStatus]}
                </div>
              );
            })}
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            {(() => {
              const statusOrder = ['writing', 'communicated', 'submitted', 'accepted', 'published'];
              const currentIndex = statusOrder.indexOf(tracker.currentStatus);
              const progress = tracker.currentStatus === 'rejected' ? 0 : ((currentIndex + 1) / statusOrder.length) * 100;
              return (
                <div 
                  className={`h-full ${tracker.currentStatus === 'rejected' ? 'bg-red-500' : 'bg-indigo-600'} transition-all duration-500`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              );
            })()}
          </div>
        </div>

        {/* Editable Form Section */}
        <div className="p-6 border-b space-y-4">
          {/* Locked Banner */}
          {isLocked && (
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg text-yellow-800 text-sm flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <div>
                <strong>This tracker is locked.</strong>
                <p className="text-xs mt-1">
                  Trackers with '{statusLabels[tracker.currentStatus]}' status cannot be edited.
                </p>
              </div>
            </div>
          )}
          
          {/* Alert Messages */}
          {updateError && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-red-800 text-sm flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {updateError}
            </div>
          )}
          {updateSuccess && (
            <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg text-green-800 text-sm flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {updateSuccess}
            </div>
          )}

          {/* Basic Information Section */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('basicInfo')}
              className="w-full px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">Required</span>
              </div>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.basicInfo ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.basicInfo && (
              <div className="p-4 space-y-4 bg-gray-50">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={(formData.title as string) || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    disabled={isLocked}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter publication title"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
                    <select
                      value={formData.currentStatus as string}
                      onChange={(e) => setFormData({ ...formData, currentStatus: e.target.value })}
                      disabled={isLocked}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select</option>
                      <option value="writing">Writing</option>
                      <option value="communicated">Communicated</option>
                      <option value="submitted">Submitted</option>
                      <option value="rejected">Rejected</option>
                      <option value="accepted">Accepted</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Completion</label>
                    <input
                      type="date"
                      value={(formData.expectedCompletionDate as string)?.split('T')[0] || ''}
                      onChange={(e) => setFormData({ ...formData, expectedCompletionDate: e.target.value })}
                      disabled={isLocked}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={(formData.notes as string) || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    disabled={isLocked}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Any additional notes or comments..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Research Classification Section */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('publicationDetails')}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-white border-b flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Research Classification</h3>
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">For reporting & ranking</span>
              </div>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.publicationDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.publicationDetails && (
              <div className="p-4 bg-gray-50 space-y-4">
                {/* Interdisciplinary */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interdisciplinary (SGT) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    {['yes', 'no'].map((v) => (
                      <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="interdisciplinary"
                          value={v}
                          checked={(formData.interdisciplinary as string) === v}
                          onChange={(e) => setFormData({ ...formData, interdisciplinary: e.target.value })}
                          disabled={isLocked}
                          className="w-4 h-4 text-purple-600 disabled:opacity-50"
                        />
                        <span className="ml-1.5 capitalize text-gray-700">{v === 'yes' ? 'Yes' : 'No'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* UN SDGs */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UN Sustainable Development Goals (SDGs)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                    {[
                      { value: '1', label: '1. No Poverty' },
                      { value: '2', label: '2. Zero Hunger' },
                      { value: '3', label: '3. Good Health' },
                      { value: '4', label: '4. Quality Education' },
                      { value: '5', label: '5. Gender Equality' },
                      { value: '6', label: '6. Clean Water' },
                      { value: '7', label: '7. Clean Energy' },
                      { value: '8', label: '8. Decent Work' },
                      { value: '9', label: '9. Industry Innovation' },
                      { value: '10', label: '10. Reduced Inequalities' },
                      { value: '11', label: '11. Sustainable Cities' },
                      { value: '12', label: '12. Responsible Consumption' },
                      { value: '13', label: '13. Climate Action' },
                      { value: '14', label: '14. Life Below Water' },
                      { value: '15', label: '15. Life on Land' },
                      { value: '16', label: '16. Peace & Justice' },
                      { value: '17', label: '17. Partnerships' },
                    ].map((sdg) => (
                      <label key={sdg.value} className="flex items-center gap-2 text-sm text-gray-700 hover:bg-purple-50 p-2 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={((formData.sdgs as string[]) || []).includes(sdg.value)}
                          onChange={(e) => {
                            const currentSdgs = (formData.sdgs as string[]) || [];
                            if (e.target.checked) {
                              setFormData({ ...formData, sdgs: [...currentSdgs, sdg.value] });
                            } else {
                              setFormData({ ...formData, sdgs: currentSdgs.filter((s: string) => s !== sdg.value) });
                            }
                          }}
                          disabled={isLocked}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                        />
                        <span className="text-xs">{sdg.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{((formData.sdgs as string[]) || []).length} goal(s) selected</p>
                </div>

                {/* Indexing Categories (Multi-select) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Indexing Categories <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">(Select all that apply)</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto bg-white">
                    {INDEXING_CATEGORIES.map((cat) => {
                      const currentCategories = (formData.indexingCategories as string[]) || [];
                      return (
                        <label 
                          key={cat.value} 
                          className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                            currentCategories.includes(cat.value) 
                              ? 'bg-purple-100 border border-purple-300' 
                              : 'hover:bg-purple-50 border border-transparent'
                          } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={currentCategories.includes(cat.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, indexingCategories: [...currentCategories, cat.value] });
                              } else {
                                const remainingCategories = currentCategories.filter(c => c !== cat.value);
                                // Clear conditional fields if category is deselected
                                const stillNeedsQuartile = remainingCategories.some(c => 
                                  INDEXING_CATEGORIES.find(ic => ic.value === c)?.requiredFields.includes('quartile')
                                );
                                const stillNeedsIF = remainingCategories.some(c => 
                                  INDEXING_CATEGORIES.find(ic => ic.value === c)?.requiredFields.includes('impactFactor')
                                );
                                const stillNeedsSJR = remainingCategories.some(c => 
                                  INDEXING_CATEGORIES.find(ic => ic.value === c)?.requiredFields.includes('sjr')
                                );
                                const stillNeedsNAAS = remainingCategories.some(c => 
                                  INDEXING_CATEGORIES.find(ic => ic.value === c)?.requiredFields.includes('naasRating')
                                );
                                const updates: Record<string, unknown> = { indexingCategories: remainingCategories };
                                if (!stillNeedsQuartile) updates.quartile = '';
                                if (!stillNeedsIF) updates.impactFactor = '';
                                if (!stillNeedsSJR) updates.sjr = '';
                                if (!stillNeedsNAAS) updates.naasRating = '';
                                setFormData({ ...formData, ...updates });
                              }
                            }}
                            disabled={isLocked}
                            className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-800">{cat.label}</span>
                            <p className="text-xs text-gray-500">{cat.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{((formData.indexingCategories as string[]) || []).length} category(ies) selected</p>
                </div>

                {/* Conditional Sub-fields based on selected indexing categories */}
                {(() => {
                  const currentCategories = (formData.indexingCategories as string[]) || [];
                  const requiredFields = new Set<string>();
                  currentCategories.forEach(cat => {
                    const category = INDEXING_CATEGORIES.find(c => c.value === cat);
                    if (category) {
                      category.requiredFields.forEach(f => requiredFields.add(f));
                    }
                  });

                  if (requiredFields.size === 0) return null;

                  return (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="w-4 h-4 text-blue-500" />
                        <h4 className="text-sm font-medium text-gray-700">Additional Required Fields</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Quartile */}
                        {requiredFields.has('quartile') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Quartile <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={(formData.quartile as string) || ''}
                              onChange={(e) => setFormData({ ...formData, quartile: e.target.value })}
                              disabled={isLocked}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100"
                            >
                              <option value="">Select Quartile</option>
                              <option value="Top 1%">Top 1%</option>
                              <option value="Top 5%">Top 5%</option>
                              <option value="Q1">Q1</option>
                              <option value="Q2">Q2</option>
                              <option value="Q3">Q3</option>
                              <option value="Q4">Q4</option>
                            </select>
                          </div>
                        )}

                        {/* SJR */}
                        {requiredFields.has('sjr') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              SJR <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              value={(formData.sjr as number) || ''}
                              onChange={(e) => setFormData({ ...formData, sjr: e.target.value ? parseFloat(e.target.value) : '' })}
                              disabled={isLocked}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100"
                              placeholder="e.g., 0.5"
                            />
                          </div>
                        )}

                        {/* Impact Factor */}
                        {requiredFields.has('impactFactor') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Impact Factor <span className="text-red-500">*</span>
                              {currentCategories.includes('subsidiary_if_above_20') && (
                                <span className="text-xs text-amber-600 ml-1">(Must be &gt; 20)</span>
                              )}
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              value={(formData.impactFactor as number) || ''}
                              onChange={(e) => setFormData({ ...formData, impactFactor: e.target.value ? parseFloat(e.target.value) : '' })}
                              disabled={isLocked}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100"
                              placeholder="e.g., 2.5"
                            />
                          </div>
                        )}

                        {/* NAAS Rating */}
                        {requiredFields.has('naasRating') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              NAAS Rating <span className="text-red-500">*</span>
                              <span className="text-xs text-amber-600 ml-1">(Must be ≥ 6 and ≤ 10)</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="6"
                              max="10"
                              value={(formData.naasRating as number) || ''}
                              onChange={(e) => setFormData({ ...formData, naasRating: e.target.value ? parseFloat(e.target.value) : '' })}
                              disabled={isLocked}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100"
                              placeholder="e.g., 7.5"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Current Progress Status & Research Metrics Section */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('statusFields')}
              className="w-full px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">
                  {statusLabels[formData.currentStatus as ResearchTrackerStatus]} Stage Details
                </h3>
                {formData.currentStatus === 'published' && <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Final Stage</span>}
              </div>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.statusFields ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.statusFields && (
              <div className="p-4 bg-gray-50 space-y-4">
                {/* Conference Sub-Type - For Conference Papers */}
                {tracker.publicationType === 'conference_paper' && (
                  <div className="pb-4 border-b border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-4">🎤 Conference Type</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Conference Sub-Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={(formData.conferenceSubType as string) || ''}
                        onChange={(e) => setFormData({ ...formData, conferenceSubType: e.target.value })}
                        disabled={isLocked}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">-- Select Conference Type --</option>
                        <option value="paper_not_indexed">Papers in Conferences (not Indexed) / Seminars / Workshops</option>
                        <option value="paper_indexed_scopus">Paper in conference proceeding indexed in Scopus</option>
                        <option value="keynote_speaker_invited_talks">Keynote Speaker / Session chair / Invited Talks</option>
                        <option value="organizer_coordinator_member">Organizer / Coordinator / Member of conference</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Status-Specific Fields */}
                {tracker.publicationType === 'research_paper' && (
                  <ResearchPaperStatusForm
                    status={formData.currentStatus as ResearchTrackerStatus}
                    data={{ ...formData, indexingCategories: formData.indexingCategories }}
                    onChange={isLocked ? () => {} : setFormData}
                  />
                )}
                {tracker.publicationType === 'book' && (
                  <BookStatusForm
                    status={formData.currentStatus as ResearchTrackerStatus}
                    data={formData}
                    onChange={isLocked ? () => {} : setFormData}
                  />
                )}
                {tracker.publicationType === 'book_chapter' && (
                  <BookChapterStatusForm
                    status={formData.currentStatus as ResearchTrackerStatus}
                    data={formData}
                    onChange={isLocked ? () => {} : setFormData}
                  />
                )}
                {tracker.publicationType === 'conference_paper' && (
                  <ConferencePaperStatusForm
                    status={formData.currentStatus as ResearchTrackerStatus}
                    data={formData}
                    onChange={isLocked ? () => {} : setFormData}
                    conferenceSubType={(formData.conferenceSubType as string) || (tracker.conferencePaperData?.conferenceSubType as string) || ''}
                  />
                )}
              </div>
            )}
          </div>

          {/* OLD HARDCODED FIELDS - KEEPING COMMENTED FOR REFERENCE
          {expandedSections.statusFields && (
                <div className="p-4 bg-gray-50 space-y-4">
                
                {/* Communicated Status Fields 
                {['communicated', 'submitted', 'under_review', 'revision_requested', 'revised', 'accepted', 'published'].includes(formData.currentStatus as string) && (
                  ... OLD FIELDS REMOVED - NOW USING STATUS FORM COMPONENTS ABOVE ...
                )}
              </div>
            )}
          </div>
          )} END OF OLD HARDCODED FIELDS */}

          {/* Document Upload Section - Always Available */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('documents')}
              className="w-full px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Attach Documents</h3>
                {uploadedDocuments.length > 0 && (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    {uploadedDocuments.length} new file{uploadedDocuments.length !== 1 ? 's' : ''} selected
                  </span>
                )}
                {tracker?.statusHistory && tracker.statusHistory.some((entry: any) => entry.attachments && entry.attachments.length > 0) && (
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                    {tracker.statusHistory.reduce((total: number, entry: any) => total + (entry.attachments?.length || 0), 0)} uploaded
                  </span>
                )}
              </div>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.documents ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.documents && (
              <div className="p-4 bg-gray-50 space-y-4">
              {/* Previously Uploaded Documents */}
              {tracker?.statusHistory && tracker.statusHistory.some((entry: any) => entry.attachments && entry.attachments.length > 0) && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Previously Uploaded Documents:
                  </p>
                  <div className="space-y-2">
                    {tracker.statusHistory.map((entry: any, idx: number) => (
                      entry.attachments && entry.attachments.length > 0 && (
                        <div key={idx} className="border-l-2 border-blue-300 pl-3 py-1">
                          <p className="text-xs text-gray-500 mb-1">
                            {new Date(entry.changedAt).toLocaleDateString()} - {entry.notes || 'Document upload'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {entry.attachments.map((att: any, i: number) => (
                              <a
                                key={i}
                                href={getFileUrl(att.path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {att.originalName}
                              </a>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload New ZIP Files
                </label>
                <input
                  type="file"
                  multiple
                  accept=".zip"
                  disabled={isLocked}
                  onChange={(e) => {
                    if (e.target.files) {
                      setUploadedDocuments(Array.from(e.target.files));
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload ZIP files containing your documents (max 50MB per file)
                </p>
              </div>

              {uploadedDocuments.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Selected Files ({uploadedDocuments.length}):
                  </p>
                  <ul className="space-y-1">
                    {uploadedDocuments.map((file, index) => (
                      <li key={index} className="flex items-center justify-between text-sm text-gray-600">
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setUploadedDocuments(uploadedDocuments.filter((_, i) => i !== index))}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Notes (Optional)
                </label>
                <textarea
                  value={documentNotes}
                  onChange={(e) => setDocumentNotes(e.target.value)}
                  rows={2}
                  disabled={isLocked}
                  placeholder="Add any notes about the documents you're uploading..."
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            )}
          </div>

          {/* Update Button - Enhanced */}
          <div className="sticky bottom-0 bg-white border-t-2 border-indigo-600 rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Ready to save changes?</span>
                <p className="text-xs text-gray-500 mt-1">
                  {Object.keys(formData).filter(key => 
                    JSON.stringify(formData[key]) !== JSON.stringify(originalData[key])
                  ).length > 0 || uploadedDocuments.length > 0
                    ? `${Object.keys(formData).filter(key => 
                        JSON.stringify(formData[key]) !== JSON.stringify(originalData[key])
                      ).length} field(s) modified${uploadedDocuments.length > 0 ? ` + ${uploadedDocuments.length} document(s)` : ''}`
                    : 'No changes yet'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(originalData);
                    setUploadedDocuments([]);
                    setDocumentNotes('');
                    setUpdateError('');
                    setUpdateSuccess('');
                  }}
                  disabled={isLocked}
                  className="px-6 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={updating || isLocked}
                  className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  {updating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : isLocked ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Locked
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Update Tracker
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline - keep this as read-only */}
        <div className="p-6 border-b">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Timeline</h3>
          <dl className="space-y-2 text-sm grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-gray-500">Started</dt>
              <dd className="font-medium">{formatDate(tracker.createdAt)}</dd>
            </div>
            {tracker.expectedCompletionDate && (
              <div>
                <dt className="text-gray-500">Expected Completion</dt>
                <dd className="font-medium">{formatDate(tracker.expectedCompletionDate)}</dd>
              </div>
            )}
            {tracker.actualCompletionDate && (
              <div>
                <dt className="text-gray-500">Completed</dt>
                <dd className="font-medium text-green-600">{formatDate(tracker.actualCompletionDate)}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">Last Updated</dt>
              <dd className="font-medium">{formatDateTime(tracker.updatedAt)}</dd>
            </div>
          </dl>
        </div>

        {/* Status History Timeline */}
        <div className="px-6 pb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Progress History</h3>
          <div className="relative">
            {tracker.statusHistory && tracker.statusHistory.length > 0 ? (
              <div className="space-y-4">
                {tracker.statusHistory.map((entry: StatusHistoryEntry, index: number) => {
                  const isMonthlyReport = entry.fromStatus === entry.toStatus;
                  const totalEntries = tracker.statusHistory?.length || 0;
                  const reversedIndex = totalEntries - index; // Reverse numbering: newest = 1
                  
                  return (
                  <div key={entry.id} className="relative flex gap-4">
                    {/* Timeline Line */}
                    {index < (tracker.statusHistory?.length || 0) - 1 && (
                      <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gray-200" />
                    )}
                    
                    {/* Timeline Dot */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isMonthlyReport ? 'bg-blue-100 text-blue-700' :
                      entry.toStatus === 'rejected' ? 'bg-red-100' :
                      entry.toStatus === 'published' ? 'bg-green-100' :
                      'bg-indigo-100'
                    }`}>
                      {isMonthlyReport ? '📝' :
                       entry.toStatus === 'rejected' ? '✗' :
                       entry.toStatus === 'published' ? '✓' :
                       reversedIndex}
                    </div>
                    
                    {/* Content */}
                    <div className={`flex-1 rounded-lg p-4 ${isMonthlyReport ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {isMonthlyReport ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              📝 Monthly Report - {statusLabels[entry.toStatus]}
                            </span>
                          ) : (
                            <>
                              {entry.fromStatus && (
                                <>
                                  <span className={`px-2 py-0.5 rounded text-xs ${statusColors[entry.fromStatus]}`}>
                                    {statusLabels[entry.fromStatus]}
                                  </span>
                                  <span className="text-gray-400">→</span>
                                </>
                              )}
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[entry.toStatus]}`}>
                                {statusLabels[entry.toStatus]}
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{formatDateTime(entry.changedAt)}</span>
                      </div>
                      
                      {/* Dates */}
                      <div className="text-sm text-gray-600 mb-2">
                        <span>Reported: {formatDate(entry.reportedDate)}</span>
                        {entry.actualDate && (
                          <span className="ml-4">Actual: {formatDate(entry.actualDate)}</span>
                        )}
                      </div>
                      
                      {/* Notes */}
                      {entry.notes && (
                        <p className="text-sm text-gray-700 mb-2">{entry.notes}</p>
                      )}
                      
                      {/* Status Data */}
                      {entry.statusData && Object.keys(entry.statusData).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          {/* Show changed fields if available */}
                          {entry.statusData.changedFields && Array.isArray(entry.statusData.changedFields) && entry.statusData.changedFields.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-gray-700 mb-2">📝 Changed Fields:</p>
                              {entry.statusData.changedFields.map((change: any, idx: number) => (
                                <div key={idx} className="text-xs bg-white rounded p-2 border border-gray-200">
                                  <div className="font-medium text-gray-700 mb-1">
                                    {formatFieldLabel(change.field)}
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1">
                                      <span className="text-gray-500">From: </span>
                                      <span className="text-red-600">{formatDisplayValue(change.field, change.oldValue) || '(empty)'}</span>
                                    </div>
                                    <span className="text-gray-400">→</span>
                                    <div className="flex-1">
                                      <span className="text-gray-500">To: </span>
                                      <span className="text-green-600">{formatDisplayValue(change.field, change.newValue) || '(empty)'}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <details className="text-sm group">
                              <summary className="cursor-pointer text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2 select-none">
                                <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                View Research Details
                              </summary>
                              <div className="mt-3 bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                                {(() => {
                                  // Flatten initialData if it exists
                                  let dataToDisplay: Record<string, unknown> = { ...entry.statusData };
                                  if (entry.statusData.initialData && typeof entry.statusData.initialData === 'object') {
                                    dataToDisplay = { ...entry.statusData.initialData };
                                  }
                                  
                                  // Group fields by category for better organization
                                  const basicFields: [string, unknown][] = [];
                                  const publicationFields: [string, unknown][] = [];
                                  const metricFields: [string, unknown][] = [];
                                  const authorFields: [string, unknown][] = [];
                                  const classificationFields: [string, unknown][] = [];
                                  const otherFields: [string, unknown][] = [];
                                  
                                  Object.entries(dataToDisplay).forEach(([key, value]) => {
                                    // Skip internal/meta fields
                                    if (['initialData', 'changedFields'].includes(key)) return;
                                    
                                    if (['manuscriptId', 'journalDetails', 'journalName', 'communicationDate', 'progressNotes'].includes(key)) {
                                      basicFields.push([key, value]);
                                    } else if (['volume', 'issue', 'pageNumbers', 'doi', 'issn', 'weblink', 'publicationUrl', 'publicationWeblink', 'publicationDate'].includes(key)) {
                                      publicationFields.push([key, value]);
                                    } else if (['impactFactor', 'sjr', 'quartile', 'naasRating'].includes(key)) {
                                      metricFields.push([key, value]);
                                    } else if (['userRole', 'coAuthors', 'totalAuthors', 'sgtAuthors', 'internalCoAuthors', 'hasInternationalAuthor'].includes(key)) {
                                      authorFields.push([key, value]);
                                    } else if (['indexingCategories', 'interdisciplinary', 'sdgs', 'hasLpuStudents', 'communicatedWithOfficialId'].includes(key)) {
                                      classificationFields.push([key, value]);
                                    } else {
                                      otherFields.push([key, value]);
                                    }
                                  });
                                  
                                  const renderFieldGroup = (title: string, fields: [string, unknown][], icon: string) => {
                                    const validFields = fields.filter(([key, value]) => formatDisplayValue(key, value) !== null);
                                    if (validFields.length === 0) return null;
                                    
                                    return (
                                      <div key={title} className="space-y-2">
                                        <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 uppercase tracking-wide">
                                          <span>{icon}</span>
                                          {title}
                                        </h4>
                                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-5">
                                          {validFields.map(([key, value]) => {
                                            const displayValue = formatDisplayValue(key, value);
                                            if (!displayValue) return null;
                                            
                                            return (
                                              <div key={key} className={`${['coAuthors', 'sdgs', 'indexingCategories', 'progressNotes', 'weblink', 'publicationUrl'].includes(key) ? 'md:col-span-2' : ''}`}>
                                                <dt className="text-xs text-gray-500 mb-0.5">{formatFieldLabel(key)}</dt>
                                                <dd className="text-sm font-medium text-gray-900 break-words">
                                                  {displayValue}
                                                </dd>
                                              </div>
                                            );
                                          })}
                                        </dl>
                                      </div>
                                    );
                                  };
                                  
                                  return (
                                    <>
                                      {renderFieldGroup('Basic Information', basicFields, '📄')}
                                      {renderFieldGroup('Publication Details', publicationFields, '📰')}
                                      {renderFieldGroup('Metrics & Indexing', metricFields, '📊')}
                                      {renderFieldGroup('Authorship', authorFields, '👥')}
                                      {renderFieldGroup('Classification', classificationFields, '🏷️')}
                                      {renderFieldGroup('Additional Details', otherFields, '📝')}
                                    </>
                                  );
                                })()}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                      
                      {/* Attachments */}
                      {entry.attachments && entry.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Attachments:</p>
                          <div className="flex flex-wrap gap-2">
                            {entry.attachments.map((att, i) => (
                              <a
                                key={i}
                                href={getFileUrl(att.path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-600 hover:underline"
                              >
                                📎 {att.originalName}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No status history yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
