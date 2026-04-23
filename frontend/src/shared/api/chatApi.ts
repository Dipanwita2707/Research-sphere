import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useChatAuthStore } from '@/shared/auth/chatAuthStore';
import { logger } from '@/shared/utils/logger';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

const chatApi = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Request interceptor — attach chat access token
chatApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useChatAuthStore.getState().getChatToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track in-flight refresh to avoid concurrent refreshes
let refreshPromise: Promise<boolean> | null = null;

// Response interceptor — auto-refresh on 401
chatApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retried) {
      return Promise.reject(error);
    }

    originalRequest._retried = true;

    // Deduplicate concurrent refresh calls
    if (!refreshPromise) {
      refreshPromise = useChatAuthStore.getState().refreshChatToken().finally(() => {
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;

    if (!refreshed) {
      logger.error('[chatApi] Refresh failed — clearing chat session');
      useChatAuthStore.getState().clearChat();
      return Promise.reject(error);
    }

    // Retry the original request with the new token
    const newToken = useChatAuthStore.getState().getChatToken();
    if (newToken) {
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
    }
    return chatApi(originalRequest);
  }
);

export default chatApi;
export { chatApi };
