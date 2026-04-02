// =====================================
  // TMS Types & Interfaces
// ==============================
  export type TmsMessageType = 'grievance' | 'assistance' | 'enquiry' | 'feedback';
export type TmsPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TmsTicketStatus = 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
export type TmsEscalationLevel = 'sub_category' | 'category' | 'master_category' | 'registrar' | 'dean_academics' | 'vice_chancellor';
export type TmsTimelineAction = 'created' | 'assigned' | 'escalated' | 'forwarded' | 'remarked' | 'status_changed' | 'resolved' | 'closed' | 'reopened' | 'auto_escalated' | 'rated';

// =====================================
  // User fragments (mirrors backend userBrief)
// =====================================
  export interface UserBrief {
  id: string;
  uid: string;
  role?: string;
  employeeDetails?: {
    displayName: string;
    empId: string;
    designation?: string;
    primaryDepartment?: { departmentName: string };
    primarySchool?: { facultyName: string };
  } | null;
  studentLogin?: {
    displayName: string;
    registrationNo: string;
    studentId?: string;
    program?: {
      programName: string;
      department?: {
        departmentName: string;
        faculty?: { facultyName: string };
      };
    };
  } | null;
}

// =====================================
  // Category hierarchy
// =====================================
  export interface CategoryEmployee {
  id: string;
  uid: string;
  employeeDetails?: {
    displayName: string;
    empId: string;
    designation?: string;
  } | null;
}

export interface TmsSubCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  employee?: CategoryEmployee | null;
  priority?: TmsPriority;
  slaHours?: number;
  categoryId?: string;
  category?: { id: string; name: string; masterCategory?: { id: string; name: string } };
}

export interface TmsCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  employee?: CategoryEmployee | null;
  subCategories?: TmsSubCategory[];
}

export interface TmsMasterCategory {
  id: string;
  name: string;
  description?: string;
  isAcademic: boolean;
  isActive: boolean;
  employee?: CategoryEmployee | null;
  categories?: TmsCategory[];
}

// =====================================
  // Timeline entry
// =====================================
  export interface TmsTimelineEntry {
  id: string;
  action: TmsTimelineAction;
  fromLevel?: TmsEscalationLevel | null;
  toLevel?: TmsEscalationLevel | null;
  remarks?: string | null;
  isAutomatic: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  performedBy?: UserBrief | null;
}

// =====================================
  // Rating
// =====================================
  export interface TmsRating {
  id: string;
  rating: number;
  feedback?: string | null;
  createdAt: string;
}

// =====================================
  // Ticket
// =====================================
  export interface TmsTicket {
  id: string;
  requestId: string;
  messageType: TmsMessageType;
  priority: TmsPriority;
  status: TmsTicketStatus;
  subject: string;
  description: string;
  contactNumber: string;
  documentPath?: string | null;
  documentName?: string | null;
  currentLevel: TmsEscalationLevel;
  escalationDeadline?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  closureRemarks?: string | null;
  createdAt: string;
  updatedAt: string;
  masterCategory: { id: string; name: string; isAcademic?: boolean };
  category: { id: string; name: string };
  subCategory: { id: string; name: string };
  createdBy: UserBrief;
  assignedTo?: UserBrief | null;
  timeline?: TmsTimelineEntry[];
  rating?: TmsRating | null;
  _count?: { timeline: number };
}

// =====================================
  // API Payloads
// =====================================
  export interface CreateTicketPayload {
  messageType: TmsMessageType;
  priority?: TmsPriority;
  masterCategoryId: string;
  categoryId: string;
  subCategoryId: string;
  subject: string;
  description: string;
  contactNumber: string;
  documentPath?: string;
  documentName?: string;
}

export interface RemarkPayload {
  remarks: string;
}

export interface EscalatePayload {
  remarks?: string;
}

export interface ResolvePayload {
  remarks: string;
}

export interface ClosePayload {
  remarks?: string;
}

export interface RatePayload {
  rating: number;
  feedback?: string;
}

// =====================================
  // List / Filter params
// =====================================
  export interface TicketListParams {
  page?: number;
  limit?: number;
  status?: TmsTicketStatus;
  messageType?: TmsMessageType;
  priority?: TmsPriority;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminTicketListParams extends TicketListParams {
  masterCategoryId?: string;
  categoryId?: string;
  subCategoryId?: string;
  assignedToId?: string;
  createdById?: string;
  currentLevel?: TmsEscalationLevel;
  startDate?: string;
  endDate?: string;
}

// =====================================
  // Analytics types
// =====================================
  export interface TmsOverviewStats {
  totalRequests: number;
  byStatus: Record<string, number>;
  byMessageType: Record<string, number>;
  byPriority: Record<string, number>;
  byEscalationLevel: Record<string, number>;
  ratings: {
    average: number | null;
    totalRatings: number;
  };
  escalations: number;
  resolution: {
    totalResolved: number;
    avgResolutionHours: number;
  };
}

export interface TmsEmployeeStat {
  employee: UserBrief;
  totalAssigned: number;
  byStatus: Record<string, number>;
  avgRating: number | null;
  totalRatings: number;
}

export interface TmsCategoryStat {
  id: string;
  name: string;
  isAcademic?: boolean;
  masterCategory?: string;
  category?: string;
  count: number;
  byStatus?: Record<string, number>;
  byPriority?: Record<string, number>;
  resolved?: number;
  avgResolutionHours?: number;
  escalations?: number;
  avgRating?: number | null;
  totalRatings?: number;
}

export interface TmsCategorySummary {
  totalTickets: number;
  totalCategories: number;
  totalSubCategories: number;
  totalMasterCategories: number;
  totalResolved: number;
  totalEscalations: number;
  academicCount: number;
  nonAcademicCount: number;
}

export interface TmsCategoryStats {
  summary?: TmsCategorySummary;
  byMasterCategory: TmsCategoryStat[];
  byCategory: TmsCategoryStat[];
  bySubCategory: TmsCategoryStat[];
}

// =====================================
  // Pagination
// =====================================
  export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// =====================================
  // Category form payloads
// =====================================
  export interface CreateMasterCategoryPayload {
  name: string;
  description?: string;
  isAcademic?: boolean;
  employeeId?: string;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  masterCategoryId: string;
  employeeId?: string;
}

export interface CreateSubCategoryPayload {
  name: string;
  description?: string;
  categoryId: string;
  employeeId?: string;
  priority?: TmsPriority;
  slaHours?: number;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string;
  isActive?: boolean;
  isAcademic?: boolean;
  employeeId?: string;
  priority?: TmsPriority;
  slaHours?: number;
}

// =====================================
  // Role Handlers (Registrar, Dean, VC)
// =====================================
  export type TmsRoleHandlerLevel = 'registrar' | 'dean_academics' | 'vice_chancellor';

export interface TmsRoleHandler {
  id: string;
  role: TmsRoleHandlerLevel;
  employeeId: string;
  employee?: CategoryEmployee | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
