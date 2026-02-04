import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logger } from '@/shared/utils/logger';

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
const TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper to get host URL (without /api/v1)
export const getHostUrl = (): string => {
  return API_URL.replace(/\/api\/v1$/, '');
};

// Helper to get file URL
export const getFileUrl = (filePath: string): string => {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
  return `${getHostUrl()}${path}`;
};

// Helper to get upload URL
export const getUploadUrl = (filePath: string): string => {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
  return `${getHostUrl()}/uploads/${cleanPath}`;
};

// Helper to get S3 download URL for research documents
// This constructs the proper API endpoint that streams files from S3
export const getResearchDocumentDownloadUrl = (
  contributionId: string,
  documentType: 'manuscript' | 'supporting',
  filename: string
): string => {
  const encodedFilename = encodeURIComponent(filename);
  return `${API_URL}/research/${contributionId}/documents/${documentType}/${encodedFilename}`;
};

// Retry configuration
interface RetryConfig {
  retries?: number;
  retryDelay?: number;
  retryCondition?: (error: AxiosError) => boolean;
}

// Default retry condition - retry on network errors and 5xx server errors
const defaultRetryCondition = (error: AxiosError): boolean => {
  // Don't retry on client errors (4xx) except 429 (rate limit)
  if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
    return error.response.status === 429;
  }
  // Retry on network errors and server errors (5xx)
  return !error.response || (error.response.status >= 500 && error.response.status < 600);
};

// Sleep helper for retry delay
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - add request ID and timestamp for debugging
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add request metadata for debugging
    (config as any)._requestId = Math.random().toString(36).substring(7);
    (config as any)._startTime = Date.now();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with retry logic
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log request duration in development
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - ((response.config as any)._startTime || 0);
      logger.debug(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as (AxiosRequestConfig & { _retryCount?: number; _requestId?: string });
    
    if (!config) {
      return Promise.reject(error);
    }

    // Initialize retry count
    config._retryCount = config._retryCount || 0;

    // Check if we should retry
    const shouldRetry = defaultRetryCondition(error) && config._retryCount < MAX_RETRIES;

    if (shouldRetry) {
      config._retryCount += 1;
      
      // Calculate delay with exponential backoff
      const delay = RETRY_DELAY * Math.pow(2, config._retryCount - 1);
      
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`[API] Retrying request (${config._retryCount}/${MAX_RETRIES}) after ${delay}ms...`);
      }
      
      await sleep(delay);
      return api(config);
    }

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[API] Error: ${error.response?.status || 'Network Error'}`, error.config?.url);
    }
    
    return Promise.reject(error);
  }
);

// Helper to unwrap nested response data
// Handles both response.data and response.data.data patterns
export const unwrapResponse = <T>(response: AxiosResponse): T => {
  const data = response.data;
  
  // If data has a nested data property, unwrap it
  if (data && typeof data === 'object' && 'data' in data && data.success !== undefined) {
    return data.data as T;
  }
  
  return data as T;
};

// Export configured instance
export default api;

// Export for direct usage with custom config
export { api, API_URL };
