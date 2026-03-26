import api from '@/shared/api/api';
import logger from '@/shared/utils/logger';

// TypeScript Interfaces
export interface IprApplication {
  id: string;
  applicationNumber?: string;  // Unique reference number like PAT-2025-0001
  applicantUserId?: string;
  applicantType: 'internal_faculty' | 'internal_student' | 'internal_staff' | 'external_academic' | 'external_industry' | 'external_other';
  iprType: 'patent' | 'copyright' | 'trademark' | 'design';
  projectType: 'phd' | 'pg_project' | 'ug_project' | 'faculty_research' | 'industry_collaboration' | 'any_other';
  filingType: 'provisional' | 'complete';
  title: string;
  description: string;
  remarks?: string;
  schoolId?: string;
  departmentId?: string;
  status: IprStatus;
  currentReviewerId?: string;
  annexureFilePath?: string;
  supportingDocsFilePaths?: string[];
  incentiveAmount?: number;
  pointsAwarded?: number;
  creditedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  applicantUser?: any;
  applicantDetails?: IprApplicantDetails;
  sdgs?: IprSdg[];
  school?: any;
  department?: any;
  reviews?: IprReview[];
  statusHistory?: IprStatusHistory[];
  financeRecords?: IprFinance[];
}

export type IprStatus =
  | 'draft'
  | 'pending_mentor_approval'
  | 'submitted'
  | 'under_drd_review'
  | 'changes_required'
  | 'resubmitted'
  | 'recommended_to_head'
  | 'drd_head_approved'
  | 'drd_approved'
  | 'drd_rejected'
  | 'drd_head_rejected'
  | 'under_dean_review'
  | 'dean_approved'
  | 'dean_rejected'
  | 'submitted_to_govt'
  | 'govt_application_filed'
  | 'govt_rejected'
  | 'published'
  | 'under_finance_review'
  | 'finance_approved'
  | 'finance_rejected'
  | 'completed'
  | 'cancelled';

export interface IprApplicantDetails {
  id: string;
  iprApplicationId: string;
  // Internal
  employeeCategory?: string;
  employeeType?: string;
  uid?: string;
  email?: string;
  phone?: string;
  universityDeptName?: string;
  // External
  externalName?: string;
  externalOption?: string;
  instituteType?: string;
  companyUniversityName?: string;
  externalEmail?: string;
  externalPhone?: string;
  externalAddress?: string;
  metadata?: any;
}

export interface IprSdg {
  id: string;
  iprApplicationId: string;
  sdgCode: string;
  sdgTitle?: string;
  createdAt: string;
}

export interface IprReview {
  id: string;
  iprApplicationId: string;
  reviewerId: string;
  reviewerRole: 'drd_member' | 'drd_dean' | 'finance';
  comments?: string;
  edits?: any;
  decision: 'pending' | 'approved' | 'rejected' | 'changes_required';
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  reviewer?: any;
}

export interface IprStatusHistory {
  id: string;
  iprApplicationId: string;
  fromStatus?: IprStatus;
  toStatus: IprStatus;
  changedById: string;
  comments?: string;
  metadata?: any;
  changedAt: string;
  changedBy?: any;
}

export interface IprFinance {
  id: string;
  iprApplicationId: string;
  financeReviewerId: string;
  auditStatus: string;
  auditComments?: string;
  incentiveAmount: number;
  pointsAwarded?: number;
  paymentReference?: string;
  creditedToAccount?: string;
  approvedAt?: string;
  creditedAt?: string;
  createdAt: string;
  updatedAt: string;
  financeReviewer?: any;
}

export interface IprStatusUpdate {
  id: string;
  iprApplicationId: string;
  createdById: string;
  updateMessage: string;
  updateType: 'hearing' | 'document_request' | 'milestone' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notifyApplicant: boolean;
  notifyInventors: boolean;
  createdAt: string;
  createdBy?: {
    uid: string;
    employeeDetails?: {
      firstName: string;
      lastName: string;
    };
  };
}

export interface CreateIprApplicationDto {
  applicantType: string;
  iprType: string;
  projectType: string;
  filingType: string;
  title: string;
  description: string;
  remarks?: string;
  schoolId?: string;
  departmentId?: string;
  sdgs?: { code: string; title: string }[];
  applicantDetails: any;
  annexureFilePath?: string;
  supportingDocsFilePaths?: string[];
  // Complete filing specific fields
  sourceProvisionalId?: string; // ID of provisional application to convert from
  prototypeFilePath?: string; // ZIP file path for complete filing prototype
}

export interface UpdateIprApplicationDto {
  title?: string;
  description?: string;
  remarks?: string;
  annexureFilePath?: string;
  supportingDocsFilePaths?: string[];
}

// IPR Service
class IprService {
  // Create new IPR application
  async createApplication(data: CreateIprApplicationDto): Promise<IprApplication> {
    const response = await api.post('/ipr/create', data);
    return response.data.data;
  }

  // Submit IPR application
  async submitApplication(id: string): Promise<IprApplication> {
    const response = await api.post(`/ipr/${id}/submit`, {});
    return response.data.data;
  }

  // Get all IPR applications (with filters)
  async getAllApplications(filters?: {
    status?: IprStatus;
    iprType?: string;
    schoolId?: string;
    departmentId?: string;
    applicantUserId?: string;
  }): Promise<IprApplication[]> {
    const response = await api.get('/ipr', {
      params: filters,
    });
    return response.data.data;
  }

  // Get single IPR application (requires DRD permissions)
  async getApplicationById(id: string): Promise<IprApplication> {
    const response = await api.get(`/ipr/${id}`);
    return response.data.data;
  }

  // Get my own IPR application by ID (no DRD permissions needed)
  async getMyApplicationById(id: string): Promise<IprApplication> {
    const response = await api.get(`/ipr/my-applications/${id}`);
    return response.data.data;
  }

  // Get my IPR applications
  async getMyApplications(params?: { page?: number; limit?: number; status?: string; iprType?: string }): Promise<{
    data: IprApplication[];
    grouped: any;
    stats: any;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const response = await api.get('/ipr/my-applications', { params });
    return response.data;
  }

  // Get published provisional applications that can be converted to complete filing
  async getMyPublishedProvisionals(): Promise<{
    available: IprApplication[];
    alreadyConverted: IprApplication[];
    total: number;
  }> {
    const response = await api.get('/ipr/my-published-provisionals');
    return response.data.data;
  }

  // Get status updates for an IPR application (hearings, document requests, milestones)
  async getStatusUpdates(applicationId: string): Promise<IprStatusUpdate[]> {
    const response = await api.get(`/drd-review/status-updates/${applicationId}`);
    return response.data.data;
  }

  // Update IPR application
  async updateApplication(
    id: string,
    data: UpdateIprApplicationDto
  ): Promise<IprApplication> {
    const response = await api.put(`/ipr/${id}`, data);
    return response.data.data;
  }

  // Delete IPR application
  async deleteApplication(id: string): Promise<void> {
    await api.delete(`/ipr/${id}`);
  }

  // Resubmit after changes
  async resubmitApplication(id: string): Promise<IprApplication> {
    const response = await api.post(`/ipr/${id}/resubmit`, {});
    return response.data.data;
  }

  // Accept DRD edits and resubmit
  async acceptEditsAndResubmit(id: string, updatedData: any): Promise<IprApplication> {
    const response = await api.post(`/drd-review/accept-edits/${id}`, { updatedData });
    return response.data.data;
  }

  // Get collaborative editing suggestions for an IPR application
  async getSuggestions(applicationId: string): Promise<any> {
    const response = await api.get(`/collaborative-editing/${applicationId}/suggestions`);
    return response.data;
  }

  // Get IPR applications where the user is a contributor (for students)
  async getContributedApplications(): Promise<{
    data: IprApplication[];
    stats: any;
  }> {
    const response = await api.get('/ipr/contributed');
    return response.data;
  }

  // Get pending mentor approvals (for faculty mentors)
  async getPendingMentorApprovals(): Promise<IprApplication[]> {
    const response = await api.get('/ipr/mentor/pending');
    return response.data.data;
  }

  // Get application by ID for mentor review
  async getMentorApplicationById(id: string): Promise<IprApplication> {
    const response = await api.get(`/ipr/mentor/application/${id}`);
    return response.data.data;
  }

  // Mentor approves IPR application
  async approveMentorApplication(id: string, comments?: string): Promise<IprApplication> {
    const response = await api.post(`/ipr/mentor/${id}/approve`, { comments });
    return response.data.data;
  }

  // Mentor rejects IPR application
  async rejectMentorApplication(id: string, comments: string): Promise<IprApplication> {
    const response = await api.post(`/ipr/mentor/${id}/reject`, { comments });
    return response.data.data;
  }

  // Get mentor review history (all applications mentor has reviewed)
  async getMentorReviewHistory(): Promise<{
    data: {
      all: IprApplication[];
      pending: IprApplication[];
      changesRequired: IprApplication[];
      approved: IprApplication[];
      rejected: IprApplication[];
    };
    stats: {
      total: number;
      pending: number;
      changesRequired: number;
      approved: number;
      rejected: number;
    };
  }> {
    const response = await api.get('/ipr/mentor/history');
    return response.data;
  }
}

// DRD Review Service
class DrdReviewService {
  // Get pending DRD reviews
  async getPendingReviews(params?: {
    page?: number;
    limit?: number;
    iprType?: string;
    schoolId?: string;
  }): Promise<{ data: IprApplication[]; pagination: any }> {
    const response = await api.get('/drd-review/pending', {
      params,
    });
    return response.data;
  }

  // Get my DRD reviews
  async getMyReviews(): Promise<IprApplication[]> {
    const response = await api.get('/drd-review/my-reviews');
    return response.data.data;
  }

  // Submit DRD review
  async submitReview(
    id: string,
    data: {
      comments?: string;
      edits?: any;
      decision: 'approved' | 'rejected' | 'changes_required';
    }
  ): Promise<IprReview> {
    const response = await api.post(`/drd-review/review/${id}`, data);
    return response.data.data;
  }

  // Final Approve DRD review with incentive calculation
  async approveReview(id: string, comments?: string): Promise<IprApplication> {
    const response = await api.post(`/drd-review/approve/${id}`, { comments });
    return response.data.data;
  }

  // Recommend for approval (DRD Member -> DRD Head)
  async recommendReview(id: string, comments: string): Promise<IprApplication> {
    const response = await api.post(`/drd-review/recommend/${id}`, { comments });
    return response.data.data;
  }

  // Final Reject DRD review
  async rejectReview(id: string, comments: string): Promise<IprApplication> {
    const response = await api.post(`/drd-review/reject/${id}`, { comments });
    return response.data.data;
  }

  // Request changes (Recommend with edits)
  async requestChanges(
    id: string,
    comments: string,
    edits?: any
  ): Promise<IprApplication> {
    const response = await api.post(`/drd-review/request-changes/${id}`, { comments, edits });
    return response.data.data;
  }

  // Dean approve application and send to finance
  async deanApprove(id: string, comments?: string): Promise<IprApplication> {
    const response = await api.post(`/dean-approval/approve/${id}`, { comments });
    return response.data.data;
  }

  // Dean reject application
  async deanReject(id: string, comments: string): Promise<IprApplication> {
    const response = await api.post(`/dean-approval/reject/${id}`, { comments });
    return response.data.data;
  }

  // Finance approve and process incentives
  async financeApprove(id: string, comments?: string): Promise<IprApplication> {
    const response = await api.post(`/finance/approve/${id}`, { comments });
    return response.data.data;
  }

  // Finance request additional audit
  async financeAudit(id: string, comments: string): Promise<IprApplication> {
    const response = await api.post(`/finance/request-audit/${id}`, { comments });
    return response.data.data;
  }

  // System administrator override (for emergency situations)
  async systemOverride(id: string, comments: string): Promise<IprApplication> {
    const response = await api.post(`/drd-review/system-override/${id}`, { comments });
    return response.data.data;
  }

  // Get DRD review statistics
  async getStatistics(): Promise<any> {
    const response = await api.get('/drd-review/statistics');
    return response.data.data;
  }

  // Get application details for review
  async getReviewDetails(id: string): Promise<IprApplication> {
    const response = await api.get(`/ipr/${id}`);
    return response.data.data;
  }
}

// Dean Approval Service
class DeanApprovalService {
  // Get pending dean approvals
  async getPendingApprovals(): Promise<IprApplication[]> {
    const response = await api.get('/dean-approval/pending');
    return response.data.data;
  }

  // Get my dean approvals
  async getMyApprovals(): Promise<IprApplication[]> {
    const response = await api.get('/dean-approval/my-approvals');
    return response.data.data;
  }

  // Approve application
  async approve(id: string, comments?: string): Promise<IprApplication> {
    const response = await api.post(`/dean-approval/approve/${id}`, { comments });
    return response.data.data;
  }

  // Reject application
  async reject(id: string, comments: string): Promise<IprApplication> {
    const response = await api.post(`/dean-approval/reject/${id}`, { comments });
    return response.data.data;
  }

  // Get application details for approval
  async getApprovalDetails(id: string): Promise<IprApplication> {
    const response = await api.get(`/dean-approval/application/${id}`);
    return response.data.data;
  }
}

// Finance Service
class FinanceService {
  // Get pending finance reviews
  async getPendingReviews(): Promise<IprApplication[]> {
    const response = await api.get('/finance/pending');
    return response.data.data;
  }

  // Get my finance reviews
  async getMyReviews(): Promise<IprApplication[]> {
    const response = await api.get('/finance/my-reviews');
    return response.data.data;
  }

  // Submit finance review
  async submitReview(
    id: string,
    data: {
      auditStatus: string;
      auditComments?: string;
      incentiveAmount: number;
      pointsAwarded?: number;
      paymentReference?: string;
      creditedToAccount?: string;
    }
  ): Promise<IprFinance> {
    const response = await api.post(`/finance/process-incentive/${id}`, data);
    return response.data.data;
  }

  // Approve finance review
  async approve(id: string): Promise<IprApplication> {
    const response = await api.post(`/finance/approve/${id}`, {});
    return response.data.data;
  }

  // Reject finance review
  async reject(id: string, comments: string): Promise<IprApplication> {
    const response = await api.post(`/finance/reject/${id}`, { comments });
    return response.data.data;
  }

  // Credit incentive
  async creditIncentive(
    id: string,
    data: {
      paymentReference: string;
      creditedToAccount: string;
    }
  ): Promise<IprApplication> {
    const response = await api.post(`/finance/credit-incentive/${id}`, data);
    return response.data.data;
  }

  // Get application details for finance review
  async getReviewDetails(id: string): Promise<IprApplication> {
    const response = await api.get(`/finance/application/${id}`);
    return response.data.data;
  }

  // Get finance statistics
  async getStats(): Promise<any> {
    const response = await api.get('/finance/stats');
    return response.data.data;
  }
}

// File Upload Service
export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresIn: number;
}

class FileUploadService {


  // Get download URL for local files
  async getDownloadUrl(filePath: string): Promise<DownloadUrlResponse> {
    // For local files, return direct download URL
    return {
      downloadUrl: `${api.defaults.baseURL}/file-upload/download/${filePath}`,
      expiresIn: 3600
    };
  }

  // Upload file to local server
  async uploadFile(file: File, folder: string = 'ipr'): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const response = await api.post('/file-upload/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'File upload failed');
      }

      // Return the file path instead of S3 key
      return response.data.data.filePath;
    } catch (error: unknown) {
      logger.error('File upload error:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosError.response?.data?.message || 'Failed to upload file');
      }
      throw new Error('Failed to upload file. Please try again.');
    }
  }

  // Upload prototype ZIP file (up to 50MB) for complete filing
  async uploadPrototypeFile(file: File): Promise<string> {
    try {
      // Validate file is ZIP
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Only ZIP files are allowed for prototype uploads');
      }

      // Validate file size (50MB max)
      const maxSize = 50 * 1024 * 1024; // 50MB in bytes
      if (file.size > maxSize) {
        throw new Error('Prototype file must be less than 50MB');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/file-upload/upload-prototype', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Prototype upload failed');
      }

      return response.data.data.filePath;
    } catch (error: unknown) {
      logger.error('Prototype upload error:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosError.response?.data?.message || 'Failed to upload prototype');
      }
      throw error;
    }
  }

  // Delete file
  async deleteFile(filePath: string): Promise<void> {
    await api.delete('/file-upload/file', {
      data: { filePath },
    });
  }
}

// Export service instances
export const iprService = new IprService();
export const drdReviewService = new DrdReviewService();
export const deanApprovalService = new DeanApprovalService();
export const financeService = new FinanceService();
export const fileUploadService = new FileUploadService();
