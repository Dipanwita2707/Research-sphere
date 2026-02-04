import api from '@/shared/api/api';

// TypeScript Interfaces
export type ResearchPublicationType = 
  | 'research_paper'
  | 'book'
  | 'book_chapter'
  | 'conference_paper'
  | 'grant_proposal';

export type ResearchContributionStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_required'
  | 'resubmitted'
  | 'approved'
  | 'rejected'
  | 'completed';

export type ResearchAuthorType = 
  | 'internal_faculty'
  | 'internal_student'
  | 'external_academic'
  | 'external_industry'
  | 'external_other';

// Grant Application Types
export type GrantProjectType = 'indian' | 'international';
export type GrantProjectStatus = 'submitted' | 'approved';
export type GrantProjectCategory = 'govt' | 'non_govt' | 'industry';
export type GrantFundingAgency = 'dst' | 'dbt' | 'anrf' | 'csir' | 'icssr' | 'other';
export type GrantInvestigatorRole = 'pi' | 'co_pi';
export type GrantApplicationStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_required'
  | 'resubmitted'
  | 'approved'
  | 'rejected';

export interface GrantConsortiumOrganization {
  id?: string;
  organizationName: string;
  country: string;
  numberOfMembers: number;
  isCoordinator?: boolean;
  displayOrder?: number;
}

export interface GrantInvestigator {
  id?: string;
  userId?: string;
  uid?: string;
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  affiliation?: string;
  department?: string;
  roleType: GrantInvestigatorRole;
  isInternal: boolean;
  investigatorType?: string;
  consortiumOrgId?: string;
  isTeamCoordinator?: boolean;
  displayOrder?: number;
}

export interface GrantApplicationData {
  title: string;
  agencyName: string;
  submittedAmount?: number;
  sdgGoals?: string[];
  projectType: GrantProjectType;
  numberOfConsortiumOrgs?: number;
  projectStatus: GrantProjectStatus;
  projectCategory: GrantProjectCategory;
  fundingAgencyType?: GrantFundingAgency;
  fundingAgencyName?: string;
  totalInvestigators: number;
  numberOfInternalPIs: number;
  numberOfInternalCoPIs: number;
  isPIExternal: boolean;
  myRole: GrantInvestigatorRole;
  dateOfSubmission?: string;
  projectStartDate?: string;
  projectEndDate?: string;
  projectDurationMonths?: number;
  schoolId?: string;
  departmentId?: string;
  status?: GrantApplicationStatus;
  consortiumOrganizations?: GrantConsortiumOrganization[];
  investigators?: GrantInvestigator[];
}

export interface GrantApplication {
  id: string;
  applicationNumber?: string;
  applicantUserId: string;
  applicantType: string;
  title: string;
  agencyName: string;
  submittedAmount?: number;
  sdgGoals: string[];
  projectType: GrantProjectType;
  numberOfConsortiumOrgs: number;
  projectStatus: GrantProjectStatus;
  projectCategory: GrantProjectCategory;
  fundingAgencyType?: GrantFundingAgency;
  fundingAgencyName?: string;
  totalInvestigators: number;
  numberOfInternalPIs: number;
  numberOfInternalCoPIs: number;
  isPIExternal: boolean;
  myRole: GrantInvestigatorRole;
  dateOfSubmission?: string;
  projectStartDate?: string;
  projectEndDate?: string;
  projectDurationMonths?: number;
  schoolId?: string;
  departmentId?: string;
  status: GrantApplicationStatus;
  submittedAt?: string;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
  consortiumOrganizations?: GrantConsortiumOrganization[];
  investigators?: GrantInvestigator[];
  statusHistory?: any[];
  reviews?: any[];
  editSuggestions?: any[];
  school?: any;
  department?: any;
  applicantUser?: any;
  calculatedIncentiveAmount?: number;
  calculatedPoints?: number;
}

export type TargetedResearchType = 
  | 'research_based_journal'
  | 'community_based_journal'
  | 'na';

export interface ResearchContribution {
  id: string;
  applicationNumber?: string;
  applicantUserId?: string;
  publicationType: ResearchPublicationType;
  title: string;
  abstract?: string;
  
  // Common fields
  publishedYear?: number;
  publishedMonth?: number;
  publishedDate?: string;
  doi?: string;
  url?: string;
  publisherName?: string;
  
  // Research paper specific
  journalName?: string;
  volume?: string;
  issue?: string;
  pageNumbers?: string;
  issn?: string;
  indexedIn?: string[];
  impactFactor?: number;
  sjr?: number;
  hasInternationalAuthor?: boolean;
  internationalAuthor?: boolean;
  targetedResearchType?: TargetedResearchType | string;
  quartile?: string;
  
  // Research characteristics
  foreignCollaborationsCount?: number;
  interdisciplinaryFromSgt?: boolean;
  studentsFromSgt?: boolean;
  sgtAffiliatedAuthors?: number;
  internalCoAuthors?: number;
  totalAuthors?: number;
  
  // Book specific
  bookTitle?: string;
  publisher?: string;
  isbn?: string;
  edition?: string;
  chapterTitle?: string;
  chapterNumber?: string;
  
  // Conference specific
  conferenceName?: string;
  conferenceDate?: string;
  conferenceLocation?: string;
  conferenceType?: string;
  proceedingsTitle?: string;
  isInvited?: boolean;
  
  // Grant specific
  grantTitle?: string;
  fundingAgency?: string;
  grantAmount?: number;
  grantStartDate?: string;
  grantEndDate?: string;
  grantStatus?: string;
  
  // Author info
  totalInternalAuthors?: number;
  totalExternalAuthors?: number;
  
  // School/Department
  schoolId?: string;
  departmentId?: string;
  
  // Status
  status: ResearchContributionStatus;
  currentReviewerId?: string;
  
  // File paths
  manuscriptFilePath?: string;
  supportingDocsFilePaths?: any;
  
  // UN Sustainable Development Goals
  sdgGoals?: string[];
  
  // Incentives
  calculatedIncentiveAmount?: number;
  calculatedPoints?: number;
  incentiveAmount?: number;
  pointsAwarded?: number;
  creditedAt?: string;
  
  // Timestamps
  submittedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  applicantUser?: any;
  applicantDetails?: ResearchApplicantDetails;
  authors?: ResearchContributionAuthor[];
  school?: any;
  department?: any;
  reviews?: ResearchReview[];
  statusHistory?: ResearchStatusHistory[];
  editSuggestions?: ResearchEditSuggestion[];
}

export interface ResearchApplicantDetails {
  id: string;
  researchContributionId: string;
  employeeCategory?: string;
  employeeType?: string;
  uid?: string;
  email?: string;
  phone?: string;
  universityDeptName?: string;
  metadata?: any;
}

export interface ResearchContributionAuthor {
  id: string;
  researchContributionId: string;
  userId?: string;
  authorType: ResearchAuthorType;
  authorCategory?: string;
  authorRole?: string;
  name: string;
  email?: string;
  affiliation?: string;
  registrationNumber?: string;
  isCorresponding?: boolean;
  orderNumber: number;
  
  // PhD linkage
  linkedForPhd?: boolean;
  usePublicationAddress?: boolean;
  usePermanentAddress?: boolean;
  
  // Incentives
  incentiveShare?: number;
  pointsShare?: number;
  
  // For fetched user data
  user?: any;
}

export interface ResearchReview {
  id: string;
  researchContributionId: string;
  reviewerId: string;
  reviewerRole: string;
  comments?: string;
  decision: string;
  reviewedAt?: string;
  reviewer?: any;
}

export interface ResearchStatusHistory {
  id: string;
  researchContributionId: string;
  fromStatus?: string;
  toStatus: string;
  changedById: string;
  comments?: string;
  createdAt: string;
  changedBy?: any;
}

export interface ResearchEditSuggestion {
  id: string;
  researchContributionId: string;
  reviewerId: string;
  fieldName: string;
  fieldPath?: string;
  originalValue?: string;
  suggestedValue: string;
  suggestionNote?: string;
  status: 'pending' | 'accepted' | 'rejected';
  applicantResponse?: string;
  respondedAt?: string;
  createdAt: string;
  reviewer?: any;
}

export interface ResearchIncentivePolicy {
  id: string;
  publicationType: ResearchPublicationType;
  indexingType?: string;
  impactFactorMin?: number;
  impactFactorMax?: number;
  baseIncentive: number;
  basePoints: number;
  firstAuthorMultiplier?: number;
  correspondingAuthorMultiplier?: number;
  internalAuthorMultiplier?: number;
  externalAuthorMultiplier?: number;
  internationalBonus?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive: boolean;
}

// Service class
class ResearchService {
  // ============================================
  // Research Contribution CRUD
  // ============================================

  async createContribution(data: Partial<ResearchContribution>) {
    const response = await api.post('/research', data);
    return response.data;
  }

  async getMyContributions() {
    const response = await api.get('/research/my-contributions');
    return response.data;
  }

  async getContributedResearch() {
    const response = await api.get('/research/contributed');
    return response.data;
  }

  async getContributionById(id: string) {
    const response = await api.get(`/research/${id}`);
    return response.data;
  }

  async updateContribution(id: string, data: Partial<ResearchContribution>) {
    const response = await api.put(`/research/${id}`, data);
    return response.data;
  }

  async submitContribution(id: string) {
    const response = await api.post(`/research/${id}/submit`);
    return response.data;
  }

  async uploadDocuments(id: string, formData: FormData) {
    const response = await api.post(`/research/${id}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async resubmitContribution(id: string) {
    const response = await api.post(`/research/${id}/resubmit`);
    return response.data;
  }

  async deleteContribution(id: string) {
    const response = await api.delete(`/research/${id}`);
    return response.data;
  }

  // ============================================
  // Author Management
  // ============================================

  async addAuthor(contributionId: string, author: Partial<ResearchContributionAuthor>) {
    const response = await api.post(`/research/${contributionId}/authors`, author);
    return response.data;
  }

  async updateAuthor(contributionId: string, authorId: string, data: Partial<ResearchContributionAuthor>) {
    const response = await api.put(`/research/${contributionId}/authors/${authorId}`, data);
    return response.data;
  }

  async removeAuthor(contributionId: string, authorId: string) {
    const response = await api.delete(`/research/${contributionId}/authors/${authorId}`);
    return response.data;
  }

  async lookupByRegistration(registrationNumber: string) {
    const response = await api.get(`/research/lookup/${registrationNumber}`);
    return response.data;
  }

  async searchUsers(query: string, role?: string) {
    const params = role ? `?role=${role}` : '';
    const response = await api.get(`/users/suggestions/${query}${params}`);
    return response.data;
  }

  // ============================================
  // Incentive Policies
  // ============================================

  async getIncentivePolicies() {
    const response = await api.get('/research/incentive-policies');
    return response.data;
  }

  // ============================================
  // DRD Review (for reviewers)
  // ============================================

  async getPendingReviews(params?: { status?: string; publicationType?: string; schoolId?: string }) {
    const response = await api.get('/research/review/pending', { params });
    return response.data;
  }

  async getReviewStatistics(params?: { schoolId?: string; publicationType?: string; startDate?: string; endDate?: string }) {
    const response = await api.get('/research/review/statistics', { params });
    return response.data;
  }

  async getSchoolsForFilter() {
    const response = await api.get('/research/review/schools');
    return response.data;
  }

  async startReview(id: string) {
    const response = await api.post(`/research/${id}/review/start`);
    return response.data;
  }

  async requestChanges(id: string, data: { comments: string; suggestions?: any[] }) {
    const response = await api.post(`/research/${id}/review/request-changes`, data);
    return response.data;
  }

  async approveContribution(id: string, data?: { comments?: string }) {
    const response = await api.post(`/research/${id}/review/approve`, data);
    return response.data;
  }

  async recommendForApproval(id: string, data?: { comments?: string }) {
    const response = await api.post(`/research/${id}/review/recommend`, data);
    return response.data;
  }

  async rejectContribution(id: string, data: { comments?: string; reason?: string }) {
    const response = await api.post(`/research/${id}/review/reject`, data);
    return response.data;
  }

  async markCompleted(id: string) {
    const response = await api.post(`/research/${id}/review/complete`);
    return response.data;
  }

  // ============================================
  // Edit Suggestions
  // ============================================

  async respondToSuggestion(suggestionId: string, data: { accept: boolean; response?: string }) {
    const response = await api.post(`/research/suggestions/${suggestionId}/respond`, data);
    return response.data;
  }

  async acceptSuggestion(contributionId: string, suggestionId: string) {
    return this.respondToSuggestion(suggestionId, { accept: true });
  }

  async rejectSuggestion(contributionId: string, suggestionId: string, response?: string) {
    return this.respondToSuggestion(suggestionId, { accept: false, response });
  }

  // ============================================
  // Grant Application Methods
  // ============================================

  async createGrantApplication(data: GrantApplicationData) {
    const response = await api.post('/grants', data);
    return response.data;
  }

  async getMyGrantApplications() {
    const response = await api.get('/grants/my-grants');
    return response.data;
  }

  async getGrantApplicationById(id: string) {
    const response = await api.get(`/grants/${id}`);
    return response.data;
  }

  async updateGrantApplication(id: string, data: GrantApplicationData) {
    const response = await api.put(`/grants/${id}`, data);
    return response.data;
  }

  async submitGrantApplication(id: string) {
    const response = await api.post(`/grants/${id}/submit`);
    return response.data;
  }

  async deleteGrantApplication(id: string) {
    const response = await api.delete(`/grants/${id}`);
    return response.data;
  }

  async getPendingGrantReviews() {
    const response = await api.get('/grants/review/pending');
    return response.data;
  }

  async startGrantReview(id: string) {
    const response = await api.post(`/grants/${id}/review/start`);
    return response.data;
  }

  async requestGrantChanges(id: string, data: { comments: string; suggestions?: any[] }) {
    const response = await api.post(`/grants/${id}/review/request-changes`, data);
    return response.data;
  }

  async recommendGrant(id: string, data?: { comments?: string }) {
    const response = await api.post(`/grants/${id}/review/recommend`, data);
    return response.data;
  }

  async approveGrant(id: string, data?: { comments?: string }) {
    const response = await api.post(`/grants/${id}/review/approve`, data);
    return response.data;
  }

  async rejectGrant(id: string, data: { comments?: string; reason?: string }) {
    const response = await api.post(`/grants/${id}/review/reject`, data);
    return response.data;
  }

  async markGrantCompleted(id: string) {
    const response = await api.post(`/grants/${id}/review/complete`);
    return response.data;
  }

  async respondToGrantSuggestion(suggestionId: string, accept: boolean) {
    const response = await api.post(`/grants/suggestions/${suggestionId}/respond`, { accept });
    return response.data;
  }
}

export const researchService = new ResearchService();
export default researchService;
