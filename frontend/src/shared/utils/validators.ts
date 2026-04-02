/**
 * Validation Utilities
 * Functions for form validation and data validation
 */

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: unknown): boolean {
  if (value ===
   null || value ===
   undefined) return true;
  if (typeof value ===
   'string') return value.trim() ===
   '';
  if (Array.isArray(value)) return value.length ===
   0;
  if (typeof value ===
   'object') return Object.keys(value).length ===
   0;
  return false;
}

/**
 * Check if a value is not empty
 */
export function isNotEmpty(value: unknown): boolean {
  return !isEmpty(value);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number (Indian format)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  // Indian phone: 10 digits or 12 digits starting with 91
  return cleaned.length ===
   10 || (cleaned.length ===
   12 && cleaned.startsWith('91'));
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate DOI format
 */
export function isValidDoi(doi: string): boolean {
  if (!doi) return false;
  // DOI format: 10.prefix/suffix
  const doiRegex = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
  return doiRegex.test(doi.trim());
}

/**
 * Validate ISSN format
 */
export function isValidIssn(issn: string): boolean {
  if (!issn) return false;
  // ISSN format: ####-#### where last digit can be X
  const issnRegex = /^\d{4}-\d{3}[\dX]$/i;
  return issnRegex.test(issn.trim());
}

/**
 * Validate ISBN format (ISBN-10 or ISBN-13)
 */
export function isValidIsbn(isbn: string): boolean {
  if (!isbn) return false;
  const cleaned = isbn.replace(/[-\s]/g, '');
  
  // ISBN-10
  if (cleaned.length ===
   10) {
    const isbnRegex = /^\d{9}[\dX]$/i;
    return isbnRegex.test(cleaned);
  }
  
  // ISBN-13
  if (cleaned.length ===
   13) {
    const isbnRegex = /^\d{13}$/;
    return isbnRegex.test(cleaned);
  }
  
  return false;
}

/**
 * Validate minimum length
 */
export function hasMinLength(value: string, minLength: number): boolean {
  if (!value) return false;
  return value.trim().length >= minLength;
}

/**
 * Validate maximum length
 */
export function hasMaxLength(value: string, maxLength: number): boolean {
  if (!value) return true;
  return value.trim().length <= maxLength;
}

/**
 * Validate number range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  if (typeof value !== 'number' || isNaN(value)) return false;
  return value >= min && value <= max;
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: unknown): boolean {
  const num = typeof value ===
   'string' ? parseFloat(value) : value;
  return typeof num ===
   'number' && !isNaN(num) && num > 0;
}

/**
 * Validate non-negative number
 */
export function isNonNegativeNumber(value: unknown): boolean {
  const num = typeof value ===
   'string' ? parseFloat(value) : value;
  return typeof num ===
   'number' && !isNaN(num) && num >= 0;
}

/**
 * Validate date format (ISO date string)
 */
export function isValidDate(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validate date is in the past
 */
export function isDateInPast(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date < new Date();
}

/**
 * Validate date is in the future
 */
export function isDateInFuture(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date > new Date();
}

/**
 * Validate file extension
 */
export function hasValidExtension(filename: string, allowedExtensions: string[]): boolean {
  if (!filename) return false;
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? allowedExtensions.includes(ext) : false;
}

/**
 * Validate file size (in bytes)
 */
export function isValidFileSize(sizeInBytes: number, maxSizeInMB: number): boolean {
  const maxBytes = maxSizeInMB * 1024 * 1024;
  return sizeInBytes <= maxBytes;
}

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Create a validation result
 */
export function createValidationResult(isValid: boolean, errors: string[] = []): ValidationResult {
  return { isValid, errors };
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return {
    isValid: errors.length ===
   0,
    errors,
  };
}

/**
 * Common validation schemas
 */
export const validationRules = {
  required: (fieldName: string) => (value: unknown): ValidationResult => {
    const isValid = isNotEmpty(value);
    return createValidationResult(isValid, isValid ? [] : [`${fieldName} is required`]);
  },
  
  email: (value: string): ValidationResult => {
    if (!value) return createValidationResult(true);
    const isValid = isValidEmail(value);
    return createValidationResult(isValid, isValid ? [] : ['Invalid email format']);
  },
  
  phone: (value: string): ValidationResult => {
    if (!value) return createValidationResult(true);
    const isValid = isValidPhone(value);
    return createValidationResult(isValid, isValid ? [] : ['Invalid phone number']);
  },
  
  minLength: (min: number, fieldName: string) => (value: string): ValidationResult => {
    if (!value) return createValidationResult(true);
    const isValid = hasMinLength(value, min);
    return createValidationResult(isValid, isValid ? [] : [`${fieldName} must be at least ${min} characters`]);
  },
  
  maxLength: (max: number, fieldName: string) => (value: string): ValidationResult => {
    const isValid = hasMaxLength(value, max);
    return createValidationResult(isValid, isValid ? [] : [`${fieldName} must not exceed ${max} characters`]);
  },
};
