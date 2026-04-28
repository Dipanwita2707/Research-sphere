import api from '@/shared/api/api';

// TypeScript Types
export type ResearchTrackerStatus = 
  | 'writing'
  | 'communicated'
  | 'submitted'
  | 'rejected'
  | 'accepted'
  | 'published';

export type TrackerPublicationType = 
  | 'research_paper'
  | 'book'
  | 'book_chapter'
  | 'conference_paper';

// Research Paper specific data
export interface ResearchPaperData {
  // Writing stage
  targetJournal?: string;
  targetQuartile?: string;
  coAuthors?: string[];
  expectedSubmissionDate?: string;
  
  // Submitted stage
  journalName?: string;
  submissionDate?: string;
  manuscriptId?: string;
  
  // Under review stage
  reviewStartDate?: string;
  reviewerComments?: string;
  
  // Revision stage
  revisionNumber?: number;
  revisionNotes?: string;
  resubmissionDate?: string;
  
  // Accepted stage
  acceptanceDate?: string;
  acceptanceLetter?: string;
  
  // Published stage
  publicationDate?: string;
  doi?: string;
  volume?: string;
  issue?: string;
  pageNumbers?: string;
  impactFactor?: number;
  sjr?: number;
  quartile?: string;
  issn?: string;
  indexedIn?: string;
  weblink?: string;
}

// Book specific data
export interface BookData {
  // Writing stage
  targetPublisher?: string;
  bookType?: string; // textbook, reference, edited, etc.
  expectedChapters?: number;
  expectedCompletionDate?: string;
  
  // Submitted stage
  publisherName?: string;
  submissionDate?: string;
  proposalAccepted?: boolean;
  
  // Under review stage
  reviewStartDate?: string;
  editorComments?: string;
  
  // Accepted stage
  acceptanceDate?: string;
  contractSigned?: boolean;
  
  // Published stage
  publicationDate?: string;
  isbn?: string;
  edition?: string;
  totalPages?: number;
  publisherLocation?: string;
  bookIndexingType?: string;
  nationalInternational?: string;
}

// Book Chapter specific data
export interface BookChapterData {
  // Writing stage
  bookTitle?: string;
  chapterTitle?: string;
  editors?: string;
  targetPublisher?: string;
  expectedSubmissionDate?: string;
  
  // Submitted stage
  submissionDate?: string;
  chapterNumber?: string;
  
  // Under review stage
  reviewStartDate?: string;
  editorFeedback?: string;
  
  // Accepted stage
  acceptanceDate?: string;
  
  // Published stage
  publicationDate?: string;
  isbn?: string;
  pageNumbers?: string;
  doi?: string;
  publisherName?: string;
  publisherLocation?: string;
  edition?: string;
  bookIndexingType?: string;
}

// Conference Paper specific data
export interface ConferencePaperData {
  // Writing stage
  targetConference?: string;
  conferenceSubType?: string;
  expectedSubmissionDate?: string;
  
  // Submitted stage
  conferenceName?: string;
  submissionDate?: string;
  paperId?: string;
  
  // Under review stage
  reviewStartDate?: string;
  reviewerComments?: string;
  
  // Accepted stage
  acceptanceDate?: string;
  presentationType?: string; // oral, poster, keynote
  isPresenter?: boolean;
  
  // Published/Presented stage
  conferenceDate?: string;
  conferenceLocation?: string;
  conferenceHeldAtSgt?: boolean;
  virtualConference?: boolean;
  proceedingsTitle?: string;
  proceedingsQuartile?: string;
  indexedIn?: string;
  doi?: string;
  issnIsbn?: string;
  volume?: string;
  pageNumbers?: string;
  conferenceBestPaperAward?: boolean;
  totalPresenters?: number;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: ResearchTrackerStatus | null;
  toStatus: ResearchTrackerStatus;
  reportedDate: string;
  actualDate?: string;
  notes?: string;
  statusData?: Record<string, unknown>;
  attachments?: Array<{
    originalName: string;
    filename: string;
    path: string;
    size: number;
    mimetype: string;
    uploadedAt: string;
  }>;
  changedAt: string;
}

export interface ResearchProgressTracker {
  id: string;
  trackingNumber: string;
  userId: string;
  publicationType: TrackerPublicationType;
  title: string;
  currentStatus: ResearchTrackerStatus;
  schoolId?: string;
  departmentId?: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  notes?: string;
  researchContributionId?: string;
  
  // Type-specific data
  researchPaperData?: ResearchPaperData;
  bookData?: BookData;
  bookChapterData?: BookChapterData;
  conferencePaperData?: ConferencePaperData;
  
  // Relations
  user?: {
    id: string;
    uid: string;
    email?: string;
    employeeDetails?: {
      firstName: string;
      lastName?: string;
      displayName?: string;
      designation?: string;
    };
  };
  school?: {
    id: string;
    name?: string;
    facultyName?: string;
    shortName?: string;
  };
  department?: {
    id: string;
    name?: string;
    departmentName?: string;
    shortName?: string;
  };
  statusHistory?: StatusHistoryEntry[];
  researchContribution?: {
    id: string;
    applicationNumber?: string;
    status: string;
    incentiveAmount?: number;
    pointsAwarded?: number;
  };
  
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrackerRequest {
  publicationType: TrackerPublicationType;
  title: string;
  schoolId?: string;
  departmentId?: string;
  expectedCompletionDate?: string;
  notes?: string;
  currentStatus?: ResearchTrackerStatus;
  researchPaperData?: ResearchPaperData;
  bookData?: BookData;
  bookChapterData?: BookChapterData;
  conferencePaperData?: ConferencePaperData;
}

export interface UpdateTrackerRequest {
  title?: string;
  expectedCompletionDate?: string;
  notes?: string;
  researchPaperData?: ResearchPaperData;
  bookData?: BookData;
  bookChapterData?: BookChapterData;
  conferencePaperData?: ConferencePaperData;
}

export interface UpdateStatusRequest {
  newStatus: ResearchTrackerStatus;
  reportedDate?: string;
  actualDate?: string;
  notes?: string;
  statusData?: Record<string, unknown>;
  attachments?: Array<{
    originalName: string;
    filename: string;
    path: string;
  }>;
}

export interface TrackerStats {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  total: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API Service
const progressTrackerService = {
  // Create a new tracker
  createTracker: async (data: CreateTrackerRequest) => {
    const response = await api.post('/research-progress', data);
    return response.data;
  },

  // Get all trackers for current user
  getMyTrackers: async (params?: {
    status?: ResearchTrackerStatus;
    publicationType?: TrackerPublicationType;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ResearchProgressTracker>> => {
    const response = await api.get('/research-progress/my', { params });
    return response.data;
  },

  // Get tracker by ID
  getTrackerById: async (id: string): Promise<{ success: boolean; data: ResearchProgressTracker }> => {
    const response = await api.get(`/research-progress/${id}`);
    return response.data;
  },

  // Update tracker details
  updateTracker: async (id: string, data: UpdateTrackerRequest) => {
    const response = await api.put(`/research-progress/${id}`, data);
    return response.data;
  },

  // Update tracker with status change
  updateTrackerWithStatus: async (id: string, data: UpdateTrackerRequest & UpdateStatusRequest) => {
    const response = await api.put(`/research-progress/${id}`, data);
    return response.data;
  },

  // Delete tracker
  deleteTracker: async (id: string) => {
    const response = await api.delete(`/research-progress/${id}`);
    return response.data;
  },

  // Update tracker status
  updateStatus: async (id: string, data: UpdateStatusRequest) => {
    const response = await api.post(`/research-progress/${id}/status`, data);
    return response.data;
  },

  // Get tracker stats
  getStats: async (): Promise<{ success: boolean; data: TrackerStats }> => {
    const response = await api.get('/research-progress/stats');
    return response.data;
  },

  // Get tracker for submission (pre-fill incentive form)
  getTrackerForSubmission: async (id: string) => {
    const response = await api.get(`/research-progress/${id}/for-submission`);
    return response.data;
  },

  // Link tracker to contribution
  linkToContribution: async (id: string, contributionId: string) => {
    const response = await api.post(`/research-progress/${id}/link-contribution`, { contributionId });
    return response.data;
  },

  // Get tracker history for a contribution (for DRD reviewers)
  getTrackerHistoryForContribution: async (contributionId: string) => {
    const response = await api.get(`/research-progress/contribution/${contributionId}/history`);
    return response.data;
  },

  // Upload attachments
  uploadAttachments: async (id: string, formData: FormData) => {
    const response = await api.post(`/research-progress/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Status display helpers
export const statusLabels: Record<ResearchTrackerStatus, string> = {
  writing: 'Writing',
  communicated: 'Communicated',
  submitted: 'Submitted',
  rejected: 'Rejected',
  accepted: 'Accepted',
  published: 'Published',
};

export const statusColors: Record<ResearchTrackerStatus, string> = {
  writing: 'bg-gray-100 text-gray-800',
  communicated: 'bg-blue-100 text-blue-800',
  submitted: 'bg-indigo-100 text-indigo-800',
  rejected: 'bg-red-100 text-red-800',
  accepted: 'bg-green-100 text-green-800',
  published: 'bg-emerald-100 text-emerald-800',
};

export const publicationTypeLabels: Record<TrackerPublicationType, string> = {
  research_paper: 'Research Paper',
  book: 'Book',
  book_chapter: 'Book Chapter',
  conference_paper: 'Conference Paper',
};

export const publicationTypeIcons: Record<TrackerPublicationType, string> = {
  research_paper: '📄',
  book: '📚',
  book_chapter: '📖',
  conference_paper: '🎤',
};

// Valid status transitions
export const validTransitions: Record<ResearchTrackerStatus, ResearchTrackerStatus[]> = {
  writing: ['writing', 'communicated'],
  communicated: ['communicated', 'writing', 'submitted', 'rejected'],
  submitted: ['submitted', 'rejected', 'accepted'],
  rejected: ['writing', 'communicated', 'submitted'],
  accepted: ['accepted', 'published'],
  published: ['published'],
};

export default progressTrackerService;
