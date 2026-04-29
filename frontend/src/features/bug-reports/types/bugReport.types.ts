/**
 * Bug Report System - TypeScript Type Definitions
 * 
 * This file contains all TypeScript interfaces and types for the bug report system.
 * These types match the backend API response structures and are used throughout
 * the frontend components.
 */

/**
 * Resolution status of a bug report
 */
export type ResolutionStatus = 'resolved' | 'unresolved';

/**
 * Screenshot metadata associated with a bug report
 */
export interface Screenshot {
  id: string;
  bugReportId: string;
  originalFilename: string;
  storedFilename: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedAt: string;
}

/**
 * Complete bug report record from the database
 */
export interface BugReport {
  id: string;
  userId: string;
  userRole: string;
  userIdentifier: string;
  userEmail: string | null;
  description: string;
  pageUrl: string;
  routePath: string;
  resolutionStatus: ResolutionStatus;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  screenshots: Screenshot[];
}

/**
 * Bug report submission data from the form
 */
export interface BugReportSubmission {
  description: string;
  pageUrl: string;
  routePath: string;
  screenshots: File[];
}

/**
 * Filter options for the admin dashboard
 */
export interface BugReportFilters {
  status: 'all' | 'resolved' | 'unresolved';
  search: string;
  sortBy: 'createdAt' | 'resolutionStatus' | 'userRole';
  order: 'asc' | 'desc';
  page: number;
  limit: number;
}

/**
 * Pagination metadata from API responses
 */
export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Bug report counts by status
 */
export interface BugReportCounts {
  total: number;
  resolved: number;
  unresolved: number;
}

/**
 * Paginated bug report list response from API
 */
export interface BugReportListResponse {
  reports: BugReport[];
  pagination: PaginationMetadata;
  counts: BugReportCounts;
}

/**
 * User information for bug report reporter
 */
export interface BugReportReporter {
  uid: string;
  email: string;
  role: string;
  name?: string;
}

/**
 * User information for bug report resolver (admin)
 */
export interface BugReportResolver {
  uid: string;
  email: string;
  name?: string;
}

/**
 * Detailed bug report with reporter and resolver information
 */
export interface BugReportDetail extends BugReport {
  reporter: BugReportReporter;
  resolver?: BugReportResolver;
}

/**
 * Request body for updating bug report resolution status
 */
export interface UpdateResolutionStatusRequest {
  status: ResolutionStatus;
}

/**
 * Response from resolution status update
 */
export interface UpdateResolutionStatusResponse {
  id: string;
  resolutionStatus: ResolutionStatus;
  resolvedAt: string | null;
  resolvedBy: string | null;
  updatedAt: string;
}

/**
 * Form validation errors
 */
export interface BugReportFormErrors {
  description?: string;
  screenshots?: string;
  general?: string;
}

/**
 * Screenshot upload progress tracking
 */
export interface ScreenshotUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}
