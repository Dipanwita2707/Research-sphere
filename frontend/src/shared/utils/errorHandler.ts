/**
 * Centralized Error Handling Utilities
 * Standardized error handling across the application
 */

import { AxiosError } from 'axios';
import { ApiError, ApiErrorResponse } from '@/shared/types/api.types';
import logger from '@/shared/utils/logger';

function normalizeApiFieldErrors(
  errors?: Record<string, string | string[]>,
): Record<string, string> | undefined {
  if (!errors || typeof errors !== 'object') return undefined;

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (typeof value === 'string' && value.trim()) {
      normalized[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === 'string' && item.trim());
      if (first) {
        normalized[key] = first;
      }
    }
  }

  return Object.keys(normalized).length ? normalized : undefined;
}

/**
 * Extract user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  // Handle null/undefined
  if (!error) {
    return 'An unknown error occurred';
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle ApiError
  if (error instanceof ApiError) {
    return error.message;
  }

  // Handle Axios errors
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const fieldErrors = normalizeApiFieldErrors(axiosError.response?.data?.errors);
    if (fieldErrors) {
      const firstFieldError = Object.values(fieldErrors)[0];
      if (firstFieldError) return firstFieldError;
    }
    
    // Check for response data message
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    
    // Check for response data error
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error;
    }
    
    // Handle specific status codes
    switch (axiosError.response?.status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'You are not authenticated. Please log in.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'A conflict occurred. The resource may already exist.';
      case 422:
        return 'Validation failed. Please check your input.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Service unavailable. Please try again later.';
      default:
        break;
    }
    
    // Handle network errors
    if (axiosError.code === 'ECONNABORTED') {
      return 'Request timed out. Please try again.';
    }
    
    if (axiosError.code === 'ERR_NETWORK') {
      return 'Network error. Please check your connection.';
    }
    
    // Fallback to error message
    if (axiosError.message) {
      return axiosError.message;
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle objects with message property
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  // Fallback
  return 'An unexpected error occurred';
}

/**
 * Check if error is an Axios error
 */
export function isAxiosError(error: unknown): error is AxiosError {
  return Boolean(error && typeof error === 'object' && 'isAxiosError' in error);
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (isAxiosError(error)) {
    return (error as AxiosError).response?.status;
  }
  
  if (error instanceof ApiError) {
    return error.statusCode;
  }
  
  return undefined;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    return axiosError.code === 'ERR_NETWORK' || !axiosError.response;
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error);
  return statusCode === 401;
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error);
  return statusCode === 403;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error);
  return statusCode === 400 || statusCode === 422;
}

/**
 * Get validation errors from API response
 */
export function getValidationErrors(error: unknown): Record<string, string> | undefined {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return normalizeApiFieldErrors(axiosError.response?.data?.errors);
  }
  
  if (error instanceof ApiError) {
    return normalizeApiFieldErrors(error.errors);
  }
  
  return undefined;
}

/**
 * Create a standardized ApiError from any error
 */
export function normalizeError(error: unknown): ApiError {
  const message = getErrorMessage(error);
  const statusCode = getErrorStatusCode(error) || 500;
  const errors = getValidationErrors(error);
  
  return new ApiError(message, statusCode, errors, error);
}

/**
 * Error handler options
 */
export interface HandleErrorOptions {
  // Show toast notification
  showToast?: boolean;
  // Log to console
  logToConsole?: boolean;
  // Custom message override
  customMessage?: string;
  // Context for logging
  context?: string;
  // Callback for custom handling
  onError?: (error: ApiError) => void;
}

/**
 * Centralized error handler
 * Use this in catch blocks for consistent error handling
 */
export function handleError(
  error: unknown,
  options: HandleErrorOptions = {}
): ApiError {
  const {
    showToast = true,
    logToConsole = process.env.NODE_ENV === 'development',
    customMessage,
    context,
    onError,
  } = options;

  const normalizedError = normalizeError(error);
  const displayMessage = customMessage || normalizedError.message;

  // Log to console in development
  if (logToConsole) {
    const logPrefix = context ? `[${context}]` : '[Error]';
    logger.error(logPrefix, {
      message: displayMessage,
      statusCode: normalizedError.statusCode,
      errors: normalizedError.errors,
      originalError: normalizedError.originalError,
    });
  }

  // Show toast notification
  // Note: This will need to be connected to the toast system
  if (showToast && typeof window !== 'undefined') {
    // TODO: Integrate with toast system
    // toast.error(displayMessage);
    logger.debug('Toast would show:', displayMessage);
  }

  // Call custom handler
  if (onError) {
    onError(normalizedError);
  }

  return normalizedError;
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options?: HandleErrorOptions
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    try {
      return await fn(...args) as ReturnType<T>;
    } catch (error) {
      handleError(error, options);
      return undefined;
    }
  };
}

/**
 * Try-catch wrapper that returns a result tuple
 */
export async function tryCatch<T>(
  promise: Promise<T>
): Promise<[T, null] | [null, ApiError]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    const normalizedError = normalizeError(error);
    return [null, normalizedError];
  }
}
