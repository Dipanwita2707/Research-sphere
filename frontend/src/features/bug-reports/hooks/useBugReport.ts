'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/shared/api/api';
import { useAuthStore } from '@/shared/auth/authStore';
import type { BugReportFormErrors } from '../types/bugReport.types';
import { logBugReportSubmissionError, logNetworkError } from '../utils/errorLogger';

interface UseBugReportReturn {
  description: string;
  setDescription: (value: string) => void;
  screenshots: File[];
  setScreenshots: (files: File[]) => void;
  errors: BugReportFormErrors;
  isSubmitting: boolean;
  submitBugReport: () => Promise<void>;
  resetForm: () => void;
  validateForm: () => boolean;
  retrySubmit: () => Promise<void>;
}

const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_SCREENSHOTS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function useBugReport(): UseBugReportReturn {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [errors, setErrors] = useState<BugReportFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = useCallback((): boolean => {
    const newErrors: BugReportFormErrors = {};

    // Validate description
    if (!description.trim()) {
      newErrors.description = 'Bug description is required';
    } else if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      newErrors.description = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`;
    }

    // Validate screenshots
    if (screenshots.length > MAX_SCREENSHOTS) {
      newErrors.screenshots = `You can upload a maximum of ${MAX_SCREENSHOTS} screenshots`;
    }

    for (const file of screenshots) {
      if (file.size > MAX_FILE_SIZE) {
        newErrors.screenshots = `File "${file.name}" exceeds the maximum size of 5MB`;
        break;
      }

      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        newErrors.screenshots = `File "${file.name}" is not a valid image type. Please upload only PNG, JPEG, GIF, or WebP files.`;
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [description, screenshots]);

  const handleSubmitError = useCallback((error: any) => {
    // Log error for monitoring
    const userIdentifier = user?.uid || user?.id || 'unknown';
    logBugReportSubmissionError(error, user?.id, userIdentifier, {
      descriptionLength: description.length,
      screenshotCount: screenshots.length,
    });

    // Network error - no response from server
    if (!error.response) {
      logNetworkError('submitBugReport', error, user?.id);
      setErrors({ 
        general: 'Unable to connect. Please check your internet connection and try again.' 
      });
      return;
    }

    // Handle specific HTTP error codes
    const status = error.response.status;
    const errorData = error.response.data;

    switch (status) {
      case 400:
        // Bad Request - validation errors
        const validationMessage = errorData?.message || errorData?.error || 'Invalid bug report data. Please check your input.';
        setErrors({ general: validationMessage });
        break;

      case 401:
        // Unauthorized - authentication required
        setErrors({ general: 'You must be logged in to submit a bug report. Please log in and try again.' });
        break;

      case 403:
        // Forbidden - permission denied
        setErrors({ general: "You don't have permission to perform this action." });
        break;

      case 404:
        // Not Found
        setErrors({ general: 'The requested resource was not found.' });
        break;

      case 413:
        // Payload Too Large
        setErrors({ general: 'File size too large. Please reduce the size of your screenshots.' });
        break;

      case 429:
        // Too Many Requests - rate limit
        setErrors({ general: 'Too many requests. Please wait a moment and try again.' });
        break;

      case 500:
      case 502:
      case 503:
      case 504:
        // Server errors
        setErrors({ general: 'Something went wrong on our end. Please try again later.' });
        break;

      default:
        // Unknown error
        setErrors({ general: 'An unexpected error occurred. Please try again.' });
    }
  }, [user, description, screenshots]);

  const submitBugReport = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    if (!user) {
      setErrors({ general: 'You must be logged in to submit a bug report' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Get current page URL and route path
      const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
      const routePath = pathname || '';

      // Determine user identifier based on role
      let userIdentifier = user.uid || user.id;
      if (user.student?.registrationNo) {
        userIdentifier = user.student.registrationNo;
      } else if (user.employee?.empId) {
        userIdentifier = user.employee.empId;
      }

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('description', description.trim());
      formData.append('pageUrl', pageUrl);
      formData.append('routePath', routePath);
      formData.append('userIdentifier', userIdentifier);
      formData.append('userRole', user.userType || 'unknown');
      if (user.email) {
        formData.append('userEmail', user.email);
      }

      // Append screenshots
      screenshots.forEach((file) => {
        formData.append('screenshots', file);
      });

      // Submit to API
      await api.post('/bug-reports', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reset form on success
      resetForm();
    } catch (error: any) {
      handleSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [description, screenshots, user, pathname, validateForm, handleSubmitError]);

  const retrySubmit = useCallback(async () => {
    // Clear previous errors and retry
    setErrors({});
    await submitBugReport();
  }, [submitBugReport]);

  const resetForm = useCallback(() => {
    setDescription('');
    setScreenshots([]);
    setErrors({});
    setIsSubmitting(false);
  }, []);

  return {
    description,
    setDescription,
    screenshots,
    setScreenshots,
    errors,
    isSubmitting,
    submitBugReport,
    resetForm,
    validateForm,
    retrySubmit,
  };
}
