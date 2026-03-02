import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/shared/api/api';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { getErrorMessage } from '@/shared/utils/errorHandler';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseApiOptions<T> {
  // Initial data
  initialData?: T | null;
  // Auto-fetch on mount
  fetchOnMount?: boolean;
  // Dependencies that trigger refetch
  deps?: unknown[];
  // Transform response data
  transform?: (data: unknown) => T;
  // On success callback
  onSuccess?: (data: T) => void;
  // On error callback
  onError?: (error: string) => void;
}

export interface UseApiReturn<T> extends UseApiState<T> {
  // Manual fetch trigger
  fetch: () => Promise<T | null>;
  // Refetch with same params
  refetch: () => Promise<T | null>;
  // Reset state
  reset: () => void;
  // Set data manually
  setData: (data: T | null) => void;
  // Clear error
  clearError: () => void;
  // Is first load (no data yet)
  isFirstLoad: boolean;
}

/**
 * @deprecated Use TanStack Query hooks (useQuery / useMutation) instead.
 * This hook reimplements query caching, loading states, and error handling
 * that TanStack Query already provides. It will be removed in a future release.
 *
 * Migration example:
 * ```ts
 * // Before:
 * const { data, loading, error } = useApi<User[]>('/users', { fetchOnMount: true });
 *
 * // After:
 * const { data, isLoading, error } = useQuery({
 *   queryKey: ['users'],
 *   queryFn: () => api.get('/users').then(r => r.data),
 * });
 * ```
 */
export function useApi<T = unknown>(
  url: string,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const {
    initialData = null,
    fetchOnMount = false,
    deps = [],
    transform,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: initialData,
    loading: fetchOnMount,
    error: null,
  });

  const [hasLoaded, setHasLoaded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async (): Promise<T | null> => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await api.get(url, {
        signal: abortControllerRef.current.signal,
      });

      let data = response.data;

      // Handle nested data structure
      if (data && typeof data === 'object' && 'data' in data) {
        data = data.data;
      }

      // Apply transform if provided
      const transformedData = transform ? transform(data) : (data as T);

      setState({
        data: transformedData,
        loading: false,
        error: null,
      });

      setHasLoaded(true);
      onSuccess?.(transformedData);

      return transformedData;
    } catch (error) {
      // Ignore abort errors
      if ((error as Error).name === 'AbortError' || (error as AxiosError).code === 'ERR_CANCELED') {
        return null;
      }

      const errorMessage = getErrorMessage(error);

      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      onError?.(errorMessage);

      return null;
    }
  }, [url, transform, onSuccess, onError]);

  const refetch = useCallback(() => fetch(), [fetch]);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      loading: false,
      error: null,
    });
    setHasLoaded(false);
  }, [initialData]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount) {
      fetch();
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchOnMount, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    fetch,
    refetch,
    reset,
    setData,
    clearError,
    isFirstLoad: !hasLoaded && state.loading,
  };
}

/**
 * useMutation Hook
 * Handles POST/PUT/DELETE API calls
 * 
 * @example
 * const { mutate, loading, error } = useMutation<User>('/users');
 * 
 * const handleSubmit = async (data) => {
 *   const result = await mutate(data, { method: 'POST' });
 *   if (result) {
 *     toast.success('User created!');
 *   }
 * };
 */
export interface UseMutationOptions<T> {
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

export interface UseMutationReturn<T, D = unknown> {
  mutate: (data?: D, options?: AxiosRequestConfig) => Promise<T | null>;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useMutation<T = unknown, D = unknown>(
  url: string,
  defaultOptions: UseMutationOptions<T> = {}
): UseMutationReturn<T, D> {
  const {
    method = 'POST',
    onSuccess,
    onError,
  } = defaultOptions;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (data?: D, options: AxiosRequestConfig = {}): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const requestConfig: AxiosRequestConfig = {
          method,
          url,
          data,
          ...options,
        };

        const response = await api.request(requestConfig);

        let responseData = response.data;

        // Handle nested data structure
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          responseData = responseData.data;
        }

        setLoading(false);
        onSuccess?.(responseData as T);

        return responseData as T;
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        setLoading(false);
        setError(errorMessage);
        onError?.(errorMessage);

        return null;
      }
    },
    [url, method, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    mutate,
    loading,
    error,
    reset,
  };
}
