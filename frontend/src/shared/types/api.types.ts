/**
 * API Response Types
 * Standardized types for API responses
 */

// Base API response structure
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Paginated API response
export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
}

// API Error response
export interface ApiErrorResponse {
  success: false;
  message: string;
  error?: string;
  errors?: Record<string, string[]>;
  statusCode?: number;
}

// Standardized API Error class
export class ApiError extends Error {
  public statusCode: number;
  public errors?: Record<string, string[]>;
  public originalError?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    errors?: Record<string, string[]>,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.originalError = originalError;
  }
}

// Request configuration
export interface RequestConfig {
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

// File upload response
export interface FileUploadResponse {
  success: boolean;
  data: {
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  };
  message?: string;
}

// Bulk operation response
export interface BulkOperationResponse<T = unknown> {
  success: boolean;
  data: {
    succeeded: T[];
    failed: Array<{
      item: T;
      error: string;
    }>;
  };
  message?: string;
}

// List query parameters
export interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}

// Export useful utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Type for error objects from catch blocks (safer than any)
 */
export interface UnknownError {
  message?: string;
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
    status?: number;
  };
}

/**
 * Type guard to check if an error is an Axios-like error
 */
export function isAxiosLikeError(error: unknown): error is UnknownError & { isAxiosError: true } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error
  );
}

/**
 * Extract error message from any error type (safe for catch blocks)
 * @param error - The error to extract message from
 * @param fallback - Optional fallback message if no message can be extracted
 */
export function extractErrorMessage(error: unknown, fallback?: string): string {
  if (typeof error === 'string') {
    return error;
  }
  
  // Check for axios-style error response FIRST (before generic Error check)
  // so we get the server's actual message instead of "Request failed with status code 400"
  if (typeof error === 'object' && error !== null) {
    const err = error as UnknownError;
    if (err.response?.data?.message) {
      return err.response.data.message;
    }
    if (err.response?.data?.error) {
      return err.response.data.error;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'object' && error !== null) {
    const err = error as UnknownError;
    if (err.message) {
      return err.message;
    }
  }
  
  return fallback ?? 'An unexpected error occurred';
}
