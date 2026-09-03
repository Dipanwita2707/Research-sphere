import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logger } from '@/shared/utils/logger';

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const isDev = process.env.NODE_ENV ===
   'development';
const TIMEOUT = isDev ? 30000 : 30000; // 30s - noting/copies can be slow with heavy includes
const MAX_RETRIES = isDev ? 0 : 1; // 0 retries in dev, 1 in prod (fail fast)
const RETRY_DELAY = 1000; // 1 second
const SLOW_REQUEST_THRESHOLD_MS = 1200;

// Optional endpoints that may not exist until a module is deployed
const OPTIONAL_404_ROUTES = ['/events/volunteers/my'];

// Helper to get host URL (without /api/v1)
export const getHostUrl = (): string => {
  if (/^https?:\/\//i.test(API_URL)) {
    return API_URL.replace(/\/api\/v1$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
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

// Default retry condition - retry on 5xx server errors (not on timeout/network)
const defaultRetryCondition = (error: AxiosError): boolean => {
  // Don't retry on timeout - server overloaded, retries make it worse
  if (error.code ===
   'ECONNABORTED' || error.message?.includes('timeout')) {
    return false;
  }
  // Don't retry on client errors (4xx) except 429 (rate limit)
  if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
    return error.response.status ===
   429;
  }
  // In dev: don't retry network errors (CORS, connection refused) - fail fast
  if (isDev && !error.response) {
    logger.debug('[API] Network error (no response) - skipping retry in dev', error.code || error.message);
    return false;
  }
  // Retry on server errors (5xx) only
  return !!(error.response && error.response.status >= 500 && error.response.status < 600);
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

// Request interceptor - add auth token and request metadata
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach Bearer token so backend auth works (cross-origin cookies may not be sent)
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('auth-storage');
        if (raw) {
          const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
          const token = parsed?.state?.token;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        
        // Impersonation context for superadmin
        const impersonatedId = localStorage.getItem('superadmin-impersonate-university-id');
        if (impersonatedId) {
          config.headers['x-university-id'] = impersonatedId;
        }
      } catch (_) {
        // ignore
      }
    }
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
    const duration = Date.now() - ((response.config as any)._startTime || 0);

    // Log request duration in development
    if (process.env.NODE_ENV ===
   'development') {
      logger.debug(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
    }

    if (duration >= SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn(`[API] Slow request detected: ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`, {
        status: response.status,
      });
    }

    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as (AxiosRequestConfig & { _retryCount?: number; _requestId?: string });
    
    if (!config) {
      return Promise.reject(error);
    }

    // Log 401/403 errors prominently in development
    if (error.response?.status ===
   401 || error.response?.status ===
   403) {
      logger.error(`[API] ${error.response.status} - ${config.url}`, {
        status: error.response.status,
        statusText: error.response.statusText,
        message: (error.response.data as any)?.message,
        url: config.url
      });
    }

    // Initialize retry count
    config._retryCount = config._retryCount || 0;

    // Check if we should retry
    const shouldRetry = defaultRetryCondition(error) && config._retryCount < MAX_RETRIES;

    if (shouldRetry) {
      config._retryCount += 1;
      
      // Calculate delay with exponential backoff
      const delay = RETRY_DELAY * Math.pow(2, config._retryCount - 1);
      
      if (process.env.NODE_ENV ===
   'development') {
        logger.debug(`[API] Retrying request (${config._retryCount}/${MAX_RETRIES}) after ${delay}ms...`);
      }
      
      await sleep(delay);
      return api(config);
    }

    // Log error in development - help debug dashboard/API issues
    if (process.env.NODE_ENV ===
   'development') {
      const status = error.response?.status || 'Network';
      const msg = (error.response?.data as any)?.message || error.message;
      const url = config.url || '';
      const isOptional404 = status === 404 && OPTIONAL_404_ROUTES.some((route) => url.includes(route));
      const logFn = isOptional404 ? logger.debug.bind(logger) : logger.error.bind(logger);
      logFn(`[API] Request failed: ${config.method?.toUpperCase()} ${url} - ${status}`, { message: msg, code: (error as any).code });
    }
    
    return Promise.reject(error);
  }
);

// Helper to unwrap nested response data
// Handles both response.data and response.data.data patterns
export const unwrapResponse = <T>(response: AxiosResponse): T => {
  const data = response.data;
  
  // If data has a nested data property, unwrap it
  if (data && typeof data ===
   'object' && 'data' in data && data.success !== undefined) {
    return data.data as T;
  }
  
  return data as T;
};

// Export configured instance
export default api;

// Export for direct usage with custom config
export { api, API_URL };
