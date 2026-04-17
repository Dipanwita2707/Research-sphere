import api from '@/shared/api/api';

export interface DrdAnalyticsResponse {
  meta: {
    analyticsType: 'applicant' | 'drd_member' | 'drd_member_performance' | 'reviewer_detail';
    scopeApplied: {
      schoolIds: string[];
      departmentIds: string[];
      scopeLevel: string;
      resolution: 'union';
    };
    timeRange: {
      from: string;
      to: string;
    };
  };
  kpis: Record<string, number>;
  schoolWise: any[];
  departmentWise: any[];
  people: any[];
  reviewers: any[];
  extensions: {
    selfView?: boolean;
    monthlyTrend?: Array<Record<string, any>>;
    [key: string]: any;
  };
}

export interface ReviewerPerformanceEntry {
  reviewerId: string;
  reviewerName: string;
  assigned: number;
  reviewed: number;
  pending: number;
  avgTurnaroundHours: number;
  medianTurnaroundHours: number;
  lastActiveAt: string | null;
  decisionDistribution: {
    approved: number;
    rejected: number;
    sentBack: number;
    revisionRequested: number;
  };
}

export interface DrdMemberPerformanceResponse {
  meta: DrdAnalyticsResponse['meta'];
  kpis: {
    totalReviewers: number;
    totalAssigned: number;
    totalReviewed: number;
    totalPending: number;
    totalReviews: number;
    uniqueReviewers: number;
    approvedCount: number;
    rejectedCount: number;
    avgTurnaroundHours: number;
    medianTurnaroundHours: number;
  };
  reviewerPerformance: ReviewerPerformanceEntry[];
  reviewers: ReviewerPerformanceEntry[];
  trends: {
    monthly: Array<Record<string, any>>;
  };
  extensions: {
    selfView?: boolean;
  };
}

export interface ReviewerTimelineEntry {
  applicationId: string;
  category: string;
  title: string;
  applicationTitle?: string;
  submittedAt: string | null;
  assignedAt: string | null;
  reviewedAt?: string | null;
  firstResponseAt: string | null;
  turnaroundHours: number | null;
  decision: string;
  school: string;
  department: string;
}

export interface ReviewerDetailResponse {
  reviewer: {
    id: string;
    name: string;
    email?: string;
  };
  kpis: {
    assigned: number;
    reviewed: number;
    pending: number;
    totalReviews: number;
    approvedCount: number;
    rejectedCount: number;
    avgTurnaroundHours: number;
    medianTurnaroundHours: number;
    fastestTurnaroundHours?: number;
    decisionDistribution: {
      approved: number;
      rejected: number;
      sentBack: number;
      revisionRequested: number;
    };
  };
  timeline: ReviewerTimelineEntry[];
  meta: DrdAnalyticsResponse['meta'];
}

export interface PersonSubmission {
  id: string;
  submissionType: 'research' | 'book' | 'conference' | 'ipr' | 'grants';
  publicationType: string;
  applicationNumber: string | null;
  title: string;
  status: string;
  isApproved: boolean;
  submittedAt: string | null;
  publicationDate: string | null;
  venue: string | null;
  doi: string | null;
  weblink: string | null;
  indexedIn: string | null;
  quartile: string | null;
  impactFactor: number | null;
  naasRating: number | null;
  nationalInternational: string | null;
  incentiveAmount: number | null;
  calculatedIncentiveAmount: number | null;
  pointsAwarded: number | null;
  extra?: Record<string, any>;
  authors?: Array<{
    id: string;
    uid: string | null;
    name: string;
    affiliation: string | null;
    department: string | null;
    authorOrder: number;
    isCorresponding: boolean;
    authorType: 'co_author' | 'first_author' | 'corresponding_author' | 'first_and_corresponding_author';
    isInternal: boolean;
  }>;
}

export interface PersonSubmissionsResponse {
  personId: string;
  personName: string;
  schoolName: string;
  departmentName: string;
  category: string;
  totalCount: number;
  approvedCount: number;
  submissions: PersonSubmission[];
}

export interface DrdAnalyticsFilters {
  from?: string;
  to?: string;
  schoolId?: string;
  departmentId?: string;
  category?: string;
  reviewerId?: string;
}

export type TrackerStatus =
  | 'writing'
  | 'communicated'
  | 'submitted'
  | 'accepted'
  | 'published'
  | 'rejected';

export type TrackerPubType =
  | 'research_paper'
  | 'book'
  | 'book_chapter'
  | 'conference_paper'
  | 'grant_proposal';

export interface ProgressTrackerFilters {
  from?: string;
  to?: string;
  schoolId?: string;
  departmentId?: string;
  publicationType?: string;
}

export interface TrackerStatusFunnelEntry {
  status: TrackerStatus;
  count: number;
}

export interface TrackerCategoryBreakdown {
  publicationType: TrackerPubType;
  total: number;
  active: number;
  published: number;
  rejected: number;
}

export interface TrackerActiveUser {
  userId: string;
  name: string;
  schoolName: string;
  departmentName: string;
  totalTrackers: number;
  activeTrackers: number;
  publishedCount: number;
  statusTransitions: number;
}

export interface TrackerSchoolRow {
  schoolId: string;
  schoolName: string;
  totalTrackers: number;
  activeTrackers: number;
  publishedCount: number;
}

export interface TrackerDeptRow {
  departmentId: string;
  departmentName: string;
  schoolId: string | null;
  schoolName: string;
  totalTrackers: number;
  activeTrackers: number;
  publishedCount: number;
}

export interface TrackerMonthlyBucket {
  month: string;
  label: string;
  total: number;
  research_paper: number;
  book: number;
  book_chapter: number;
  conference_paper: number;
  grant_proposal: number;
  published: number;
}

export interface ProgressTrackerAnalyticsData {
  meta: {
    analyticsType: 'progress_tracker';
    scopeApplied: {
      schoolIds: string[];
      departmentIds: string[];
      scopeLevel: string;
      resolution: string;
    };
    timeRange: { from: string; to: string };
    filters: { publicationType?: string; schoolId?: string; departmentId?: string };
  };
  kpis: {
    totalTrackers: number;
    activeTrackers: number;
    publishedCount: number;
    rejectedCount: number;
    completionRate: number;
    uniqueUsers: number;
    totalStatusTransitions: number;
  };
  statusFunnel: TrackerStatusFunnelEntry[];
  categoryBreakdown: TrackerCategoryBreakdown[];
  activeUsers: TrackerActiveUser[];
  schoolWise: TrackerSchoolRow[];
  departmentWise: TrackerDeptRow[];
  monthlyTrend: TrackerMonthlyBucket[];
  avgDaysPerStatus: Partial<Record<TrackerStatus, number | null>>;
}

export interface ProgressTrackerRecord {
  id: string;
  trackingNumber: string;
  userId: string;
  userName: string;
  title: string;
  publicationType: TrackerPubType;
  currentStatus: TrackerStatus;
  schoolId: string | null;
  schoolName: string;
  departmentId: string | null;
  departmentName: string;
  expectedCompletionDate: string | null;
  actualCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
  latestStatusChangedAt: string | null;
  researchContribution: {
    id: string;
    applicationNumber: string | null;
    status: string;
    incentiveAmount: number | null;
    pointsAwarded: number | null;
  } | null;
}

export interface ProgressTrackerRecordsResponse {
  meta: {
    analyticsType: 'progress_tracker_records';
    scopeApplied: {
      schoolIds: string[];
      departmentIds: string[];
      scopeLevel: string;
      resolution: string;
    };
    timeRange: { from: string; to: string };
    filters: {
      publicationType?: string;
      schoolId?: string;
      departmentId?: string;
      status?: string;
      userId?: string;
    };
  };
  totalCount: number;
  records: ProgressTrackerRecord[];
}

export interface ApplicantPersonTrackerWorks {
  totalTrackers: number;
  ongoingCount: number;
  completedCount: number;
  publishedCount: number;
  rejectedCount: number;
  ongoingWorks: ProgressTrackerRecord[];
  completedWorks: ProgressTrackerRecord[];
}

export interface CategoryBreakdownItem {
  key: string;
  label: string;
  count: number;
  [key: string]: string | number;
}

export interface CategoryBreakdownResponse {
  research: CategoryBreakdownItem[];
  book: CategoryBreakdownItem[];
  conference: CategoryBreakdownItem[];
  conferenceSubtype: CategoryBreakdownItem[];
  ipr: CategoryBreakdownItem[];
  grant: CategoryBreakdownItem[];
  meta: { timeRange: { from: string; to: string } };
}

class DrdAnalyticsService {
  private baseUrl = '/drd-analytics';

  async getApplicantAnalytics(filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: DrdAnalyticsResponse }>(
      `${this.baseUrl}/applicant`,
      { params: filters }
    );
    return response.data;
  }

  async getCategoryBreakdown(filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: CategoryBreakdownResponse }>(
      `${this.baseUrl}/applicant/category-breakdown`,
      { params: filters }
    );
    return response.data;
  }

  async getDrdMemberAnalytics(filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: DrdAnalyticsResponse }>(
      `${this.baseUrl}/drd-member`,
      { params: filters }
    );
    return response.data;
  }

  async getApplicantSchoolAnalytics(schoolId: string, filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: DrdAnalyticsResponse }>(
      `${this.baseUrl}/applicant/schools/${schoolId}`,
      { params: filters }
    );
    return response.data;
  }

  async getApplicantDepartmentAnalytics(departmentId: string, filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: DrdAnalyticsResponse }>(
      `${this.baseUrl}/applicant/departments/${departmentId}`,
      { params: filters }
    );
    return response.data;
  }

  async getApplicantPersonAnalytics(personId: string, filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: DrdAnalyticsResponse }>(
      `${this.baseUrl}/applicant/people/${personId}`,
      { params: filters }
    );
    return response.data;
  }

  async getApplicantPersonSubmissions(personId: string, filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: PersonSubmissionsResponse }>(
      `${this.baseUrl}/applicant/people/${personId}/submissions`,
      { params: filters }
    );
    return response.data;
  }

  async getReviewerAnalytics(reviewerId: string, filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: DrdAnalyticsResponse }>(
      `${this.baseUrl}/drd-member/reviewers/${reviewerId}`,
      { params: filters }
    );
    return response.data;
  }

  async getDrdMemberPerformance(filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: DrdMemberPerformanceResponse }>(
      `${this.baseUrl}/drd-member/performance`,
      { params: filters }
    );
    return response.data;
  }

  async getReviewerPerformanceDetail(reviewerId: string, filters?: DrdAnalyticsFilters) {
    const response = await api.get<{ success: boolean; data: ReviewerDetailResponse }>(
      `${this.baseUrl}/drd-member/performance/${reviewerId}`,
      { params: filters }
    );
    return response.data;
  }

  async getProgressTrackerAnalytics(filters?: ProgressTrackerFilters) {
    const response = await api.get<{ success: boolean; data: ProgressTrackerAnalyticsData }>(
      `${this.baseUrl}/progress-tracker`,
      { params: filters }
    );
    return response.data;
  }

  async getProgressTrackerRecords(filters?: ProgressTrackerFilters & { status?: string; userId?: string }) {
    const response = await api.get<{ success: boolean; data: ProgressTrackerRecordsResponse }>(
      `${this.baseUrl}/progress-tracker/records`,
      { params: filters }
    );
    return response.data;
  }
}

export const drdAnalyticsService = new DrdAnalyticsService();
