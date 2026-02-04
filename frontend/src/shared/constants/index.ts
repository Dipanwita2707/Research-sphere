/**
 * Application-wide constants
 * Centralized location for all magic strings, codes, and configuration values
 */

// Re-export file URL helpers from the canonical source
export { getFileUrl, getUploadUrl, getHostUrl } from '@/shared/api/api';

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
} as const;

// Publication Status Values
export const PUBLICATION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_MENTOR_REVIEW: 'under_mentor_review',
  MENTOR_APPROVED: 'mentor_approved',
  MENTOR_REJECTED: 'mentor_rejected',
  UNDER_DRD_REVIEW: 'under_drd_review',
  DRD_APPROVED: 'drd_approved',
  DRD_REJECTED: 'drd_rejected',
  UNDER_DEAN_REVIEW: 'under_dean_review',
  DEAN_APPROVED: 'dean_approved',
  DEAN_REJECTED: 'dean_rejected',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVISION_REQUESTED: 'revision_requested',
  RESUBMITTED: 'resubmitted',
  CHANGES_REQUIRED: 'changes_required',
} as const;

// IPR Status Values
export const IPR_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_MENTOR_REVIEW: 'under_mentor_review',
  MENTOR_APPROVED: 'mentor_approved',
  MENTOR_REJECTED: 'mentor_rejected',
  UNDER_DRD_REVIEW: 'under_drd_review',
  DRD_APPROVED: 'drd_approved',
  DRD_REJECTED: 'drd_rejected',
  UNDER_DEAN_REVIEW: 'under_dean_review',
  DEAN_APPROVED: 'dean_approved',
  DEAN_REJECTED: 'dean_rejected',
  UNDER_FINANCE_REVIEW: 'under_finance_review',
  FINANCE_APPROVED: 'finance_approved',
  FINANCE_REJECTED: 'finance_rejected',
  COMPLETED: 'completed',
  CHANGES_REQUIRED: 'changes_required',
  RESUBMITTED: 'resubmitted',
} as const;

// Grant Status Values
export const GRANT_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
} as const;

// Suggestion/Edit Status Values
export const SUGGESTION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;

// Review Decision Values
export const REVIEW_DECISION = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CHANGES_REQUIRED: 'changes_required',
  RECOMMENDED: 'recommended',
} as const;

// Paper Publication Status (different from workflow status)
export const PAPER_PUBLICATION_STATUS = {
  PUBLISHED: 'published',
  IN_PRESS: 'in_press',
  ACCEPTED: 'accepted',
  UNDER_REVIEW: 'under_review',
} as const;

// Department Codes
export const DEPARTMENT_CODES = {
  DRD: 'DRD',
  HR: 'HR',
  FINANCE: 'FINANCE',
  IT: 'IT',
  LIBRARY: 'LIBRARY',
  REGISTRAR: 'REGISTRAR',
  ADMIN: 'ADMIN',
} as const;

// User Roles
export const USER_ROLES = {
  FACULTY: 'faculty',
  STAFF: 'staff',
  STUDENT: 'student',
  ADMIN: 'admin',
  DRD_MEMBER: 'drd_member',
  DRD_DEAN: 'drd_dean',
  FINANCE: 'finance',
  HR: 'hr',
} as const;

// Employee Categories
export const EMPLOYEE_CATEGORIES = {
  TEACHING: 'teaching',
  NON_TEACHING: 'non_teaching',
} as const;

// Employee Types
export const EMPLOYEE_TYPES = {
  PERMANENT: 'permanent',
  CONTRACTUAL: 'contractual',
  VISITING: 'visiting',
} as const;

// Publication Types
export const PUBLICATION_TYPES = {
  RESEARCH_PAPER: 'research_paper',
  BOOK: 'book',
  BOOK_CHAPTER: 'book_chapter',
  CONFERENCE_PAPER: 'conference_paper',
  PATENT: 'patent',
  GRANT: 'grant_proposal',
} as const;

// Author Types
export const AUTHOR_TYPES = {
  FACULTY: 'faculty',
  STAFF: 'staff',
  STUDENT: 'student',
  INTERNAL_FACULTY: 'internal_faculty',
  INTERNAL_STAFF: 'internal_staff',
  INTERNAL_STUDENT: 'internal_student',
  EXTERNAL: 'external',
} as const;

// Quartile Ratings
export const QUARTILES = {
  Q1: 'Q1',
  Q2: 'Q2',
  Q3: 'Q3',
  Q4: 'Q4',
  NOT_INDEXED: 'NOT_INDEXED',
} as const;

// IPR Types
export const IPR_TYPES = {
  PATENT: 'patent',
  COPYRIGHT: 'copyright',
  TRADEMARK: 'trademark',
  DESIGN: 'design',
  GEOGRAPHICAL_INDICATION: 'geographical_indication',
} as const;

// Filing Types
export const FILING_TYPES = {
  IDEA_SUBMISSION: 'idea_submission',
  COMPLETE_FILING: 'complete_filing',
} as const;

// Project Types
export const PROJECT_TYPES = {
  RESEARCH: 'research',
  TEACHING: 'teaching',
  CONSULTING: 'consulting',
  INDUSTRY: 'industry',
} as const;

// Permission Keys
export const PERMISSION_KEYS = {
  // IPR Permissions
  IPR_FILE_NEW: 'ipr_file_new',
  IPR_REVIEW: 'ipr_review',
  IPR_APPROVE: 'ipr_approve',
  IPR_VIEW_ALL: 'ipr_view_all',
  
  // Research Permissions
  RESEARCH_SUBMIT: 'research_submit',
  RESEARCH_REVIEW: 'research_review',
  RESEARCH_APPROVE: 'research_approve',
  RESEARCH_VIEW_ALL: 'research_view_all',
  
  // Grant Permissions
  GRANT_SUBMIT: 'grant_submit',
  GRANT_REVIEW: 'grant_review',
  GRANT_APPROVE: 'grant_approve',
  GRANT_VIEW_ALL: 'grant_view_all',
  
  // Admin Permissions
  ADMIN_USERS: 'admin_users',
  ADMIN_SCHOOLS: 'admin_schools',
  ADMIN_DEPARTMENTS: 'admin_departments',
  ADMIN_POLICIES: 'admin_policies',
  ADMIN_PERMISSIONS: 'admin_permissions',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    REFRESH: '/auth/refresh',
  },
  
  // Users
  USERS: {
    BASE: '/users',
    SUGGESTIONS: (uid: string) => `/users/suggestions/${uid}`,
    SEARCH: (uid: string) => `/users/search/${uid}`,
  },
  
  // Students
  STUDENTS: {
    BASE: '/students',
    BY_ID: (id: string) => `/students/${id}`,
    TOGGLE_STATUS: (id: string) => `/students/${id}/toggle-status`,
    RESET_PASSWORD: (id: string) => `/students/${id}/reset-password`,
    PROGRAMS: '/students/programs',
    SECTIONS: (programId: string) => `/students/programs/${programId}/sections`,
  },
  
  // Employees
  EMPLOYEES: {
    BASE: '/employees',
    BY_ID: (id: string) => `/employees/${id}`,
    TOGGLE_STATUS: (id: string) => `/employees/${id}/toggle-status`,
  },
  
  // Schools
  SCHOOLS: {
    BASE: '/schools',
    BY_ID: (id: string) => `/schools/${id}`,
  },
  
  // Research
  RESEARCH: {
    CONTRIBUTIONS: '/research-contributions',
    BY_ID: (id: string) => `/research-contributions/${id}`,
    MY_CONTRIBUTIONS: '/research-contributions/my-contributions',
  },
  
  // IPR
  IPR: {
    APPLICATIONS: '/ipr/applications',
    BY_ID: (id: string) => `/ipr/applications/${id}`,
    MY_APPLICATIONS: '/ipr/my-applications',
  },
  
  // Grants
  GRANTS: {
    BASE: '/grants',
    BY_ID: (id: string) => `/grants/${id}`,
    MY_GRANTS: '/grants/my-grants',
  },
  
  // Permissions
  PERMISSIONS: {
    BASE: '/permissions',
    BY_ROLE: (role: string) => `/permissions/${role}`,
    UPDATE: '/permissions/update',
  },
} as const;

// External URLs - Centralized for easy management
export const EXTERNAL_URLS = {
  // University social media
  INSTAGRAM: 'https://instagram.com/sgtuniversity',
  
  // External dashboards
  STUDENT_ADMIN_DASHBOARD: process.env.NEXT_PUBLIC_STUDENT_ADMIN_URL || '/admin/dashboard',
  
  // Placeholder images - using picsum.photos for reliable placeholders
  PLACEHOLDER_IMAGES: {
    EVENT_1: 'https://picsum.photos/seed/event1/800/600',
    EVENT_2: 'https://picsum.photos/seed/event2/800/600',
    EVENT_3: 'https://picsum.photos/seed/event3/800/600',
    EVENT_4: 'https://picsum.photos/seed/event4/800/600',
    SOCIAL_1: 'https://picsum.photos/seed/social1/400/400',
    SOCIAL_2: 'https://picsum.photos/seed/social2/400/400',
    SOCIAL_3: 'https://picsum.photos/seed/social3/400/400',
    SOCIAL_4: 'https://picsum.photos/seed/social4/400/400',
    SOCIAL_5: 'https://picsum.photos/seed/social5/400/400',
    SOCIAL_6: 'https://picsum.photos/seed/social6/400/400',
    SOCIAL_7: 'https://picsum.photos/seed/social7/400/400',
    SOCIAL_8: 'https://picsum.photos/seed/social8/400/400',
    SOCIAL_9: 'https://picsum.photos/seed/social9/400/400',
    SOCIAL_10: 'https://picsum.photos/seed/social10/400/400',
  },
} as const;

// Type exports for TypeScript
export type PublicationStatus = typeof PUBLICATION_STATUS[keyof typeof PUBLICATION_STATUS];
export type IprStatus = typeof IPR_STATUS[keyof typeof IPR_STATUS];
export type GrantStatus = typeof GRANT_STATUS[keyof typeof GRANT_STATUS];
export type DepartmentCode = typeof DEPARTMENT_CODES[keyof typeof DEPARTMENT_CODES];
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type EmployeeCategory = typeof EMPLOYEE_CATEGORIES[keyof typeof EMPLOYEE_CATEGORIES];
export type EmployeeType = typeof EMPLOYEE_TYPES[keyof typeof EMPLOYEE_TYPES];
export type PublicationType = typeof PUBLICATION_TYPES[keyof typeof PUBLICATION_TYPES];
export type AuthorType = typeof AUTHOR_TYPES[keyof typeof AUTHOR_TYPES];
export type Quartile = typeof QUARTILES[keyof typeof QUARTILES];
export type IprType = typeof IPR_TYPES[keyof typeof IPR_TYPES];
export type FilingType = typeof FILING_TYPES[keyof typeof FILING_TYPES];
export type ProjectType = typeof PROJECT_TYPES[keyof typeof PROJECT_TYPES];
export type PermissionKey = typeof PERMISSION_KEYS[keyof typeof PERMISSION_KEYS];
