/**
 * DSW Module Types
 * TypeScript type definitions for the DSW system
 */

// Club Enums
export type ClubStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'suspended'
  | 'archived';

export type ClubLifecycleState =
  | 'draft'
  | 'under_approval'
  | 'approved'
  | 'active'
  | 'suspended'
  | 'archived';

export type ClubTargetGroup = 'all' | 'ug' | 'pg' | 'phd';

export type ClubVisibility = 'public' | 'restricted';

export type ClubMeetingFrequency = 'weekly' | 'monthly' | 'event_based';

export type ClubChangeType =
  | 'name_change'
  | 'category_change'
  | 'purpose_change'
  | 'facilitator_change'
  | 'vice_chairperson_change'
  | 'governance_change'
  | 'operational_change'
  | 'other';

export type ClubChangeRequestStatus = 'pending' | 'approved' | 'rejected';

// User Role
export type UserRole = 'superadmin' | 'admin' | 'student' | 'faculty' | 'staff' | 'parent';

// Club Category
export interface ClubCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    clubs: number;
  };
}

// User Reference (minimal user info)
export interface UserReference {
  id: string;
  uid: string;
  email: string | null;
  role: UserRole;
  employeeDetails?: {
    firstName: string;
    lastName: string | null;
    displayName: string | null;
  } | null;
  studentLogin?: {
    firstName: string;
    lastName: string | null;
    displayName: string | null;
  } | null;
}

// Club Member
export interface ClubMember {
  id: string;
  clubId: string;
  studentId: string;
  joinedAt: string;
  isActive: boolean;
  addedById: string;
  removedAt: string | null;
  removedById: string | null;
  metadata: Record<string, any>;
  student?: UserReference;
  addedBy?: UserReference;
  removedBy?: UserReference | null;
}

// Club
export interface Club {
  id: string;
  clubId: string;
  name: string;
  categoryId: string;
  purpose: string;
  academicSession: string;
  facultyFacilitatorId: string;
  viceChairpersonId: string;
  targetStudentGroup: ClubTargetGroup;
  expectedActivityTypes: string[];
  codeOfConductAccepted: boolean;
  antiDiscriminationAccepted: boolean;
  meetingFrequency: ClubMeetingFrequency;
  estimatedAnnualActivityCount: number;
  infrastructureRequirements: string[];
  fundingRequired: boolean;
  estimatedFundingAmount: number | null;
  visibility: ClubVisibility;
  allowInternalCollaboration: boolean;
  allowExternalCollaboration: boolean;
  proposedEmail: string | null;
  socialMediaHandles: Record<string, string> | null;
  expectedStudentStrength: number | null;
  status: ClubStatus;
  lifecycleState: ClubLifecycleState;
  notingId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
  category?: ClubCategory;
  facultyFacilitator?: UserReference;
  viceChairperson?: UserReference;
  members?: ClubMember[];
  _count?: {
    members: number;
  };
}

// Club Creation Form Data
export interface ClubCreationFormData {
  // Step 1: Core Identity
  name: string;
  categoryId: string;
  purpose: string;
  academicSession: string;

  // Step 2: Authority & Membership
  viceChairpersonId: string;
  initialMembers?: string[];

  // Step 3: Governance & Compliance
  targetStudentGroup: ClubTargetGroup;
  expectedActivityTypes: string[];
  codeOfConductAccepted: boolean;
  antiDiscriminationAccepted: boolean;

  // Step 4: Operational Planning
  meetingFrequency: ClubMeetingFrequency;
  estimatedAnnualActivityCount: number;
  infrastructureRequirements: string[];
  fundingRequired: boolean;
  estimatedFundingAmount?: number;

  // Step 5: Visibility & Collaboration
  visibility: ClubVisibility;
  allowInternalCollaboration?: boolean;
  allowExternalCollaboration?: boolean;

  // Step 6: Optional Metadata
  proposedEmail?: string;
  socialMediaHandles?: Record<string, string>;
  expectedStudentStrength?: number;
}

// Club Change Request
export interface ClubChangeRequest {
  id: string;
  clubId: string;
  notingId: string;
  changeType: ClubChangeType;
  requestedChanges: Record<string, any>;
  justification: string;
  status: ClubChangeRequestStatus;
  requestedById: string;
  approvedById: string | null;
  rejectedById: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  club?: Club;
  requestedBy?: UserReference;
  approvedBy?: UserReference | null;
  rejectedBy?: UserReference | null;
}

// Audit Log
export interface ClubAuditLog {
  id: string;
  clubId: string;
  action: string;
  performedById: string;
  previousState: Record<string, any> | null;
  newState: Record<string, any> | null;
  changes: Record<string, any> | null;
  source: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  club?: {
    id: string;
    name: string;
    clubId: string;
  };
  performedBy?: UserReference;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Statistics
export interface DSWStatistics {
  totalClubs: number;
  activeClubs: number;
  totalMembers: number;
  totalCategories: number;
  pendingApprovals: number;
  clubsByCategory: Array<{
    categoryId: string;
    categoryName: string;
    _count: number;
  }>;
  clubsBySession: Array<{
    academicSession: string;
    _count: number;
  }>;
  clubsByStatus: Array<{
    status: string;
    _count: number;
  }>;
}

// Query Filters
export interface ClubFilters {
  page?: number;
  limit?: number;
  status?: ClubStatus;
  categoryId?: string;
  search?: string;
  academicSession?: string;
  myClubs?: boolean;
}

export interface AuditLogFilters {
  limit?: number;
  offset?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
}

// Form Step State
export interface ClubCreationStep {
  id: number;
  title: string;
  description: string;
  isComplete: boolean;
}
