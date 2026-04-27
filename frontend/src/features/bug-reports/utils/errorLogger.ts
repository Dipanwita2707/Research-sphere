/**
 * Frontend Error Logger
 * Centralized error logging for bug report system on the frontend
 */

interface ErrorContext {
  operation: string;
  error: Error | any;
  userId?: string;
  userIdentifier?: string;
  metadata?: Record<string, any>;
}

/**
 * Log error with context
 */
export const logError = (context: ErrorContext): void => {
  const {
    operation,
    error,
    userId = 'unknown',
    userIdentifier = 'unknown',
    metadata = {},
  } = context;

  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    error: {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
      stack: error?.stack,
      response: error?.response?.data,
      status: error?.response?.status,
    },
    userId,
    userIdentifier,
    metadata,
    environment: process.env.NODE_ENV || 'development',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
  };

  // Log to console in all environments
  console.error(`[Bug Report Error] ${operation}:`, logEntry);

  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with monitoring service (e.g., Sentry, LogRocket, DataDog)
    // Example:
    // Sentry.captureException(error, {
    //   tags: {
    //     operation,
    //     userId,
    //     userIdentifier,
    //   },
    //   extra: metadata,
    // });

    // For now, just log to console with production flag
    console.error('[PRODUCTION ERROR]', logEntry);
  }
};

/**
 * Log bug report submission error
 */
export const logBugReportSubmissionError = (
  error: Error | any,
  userId?: string,
  userIdentifier?: string,
  metadata?: Record<string, any>
): void => {
  logError({
    operation: 'submitBugReport',
    error,
    userId,
    userIdentifier,
    metadata,
  });
};

/**
 * Log screenshot upload error
 */
export const logScreenshotUploadError = (
  error: Error | any,
  fileName: string,
  userId?: string,
  metadata?: Record<string, any>
): void => {
  logError({
    operation: 'uploadScreenshot',
    error,
    userId,
    metadata: {
      ...metadata,
      fileName,
    },
  });
};

/**
 * Log screenshot validation error
 */
export const logScreenshotValidationError = (
  fileName: string,
  validationError: string,
  userId?: string
): void => {
  logError({
    operation: 'validateScreenshot',
    error: new Error(validationError),
    userId,
    metadata: {
      fileName,
      validationError,
    },
  });
};

/**
 * Log network error
 */
export const logNetworkError = (
  operation: string,
  error: Error | any,
  userId?: string
): void => {
  logError({
    operation: `network_${operation}`,
    error,
    userId,
    metadata: {
      isNetworkError: true,
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    },
  });
};
