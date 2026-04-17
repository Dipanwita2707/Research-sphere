import { useState, useCallback, useMemo } from 'react';

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  initialTotal?: number;
}

export interface UsePaginationReturn {
  // State
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  
  // Computed
  offset: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;
  pageRange: number[];
  
  // Actions
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setTotal: (total: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  reset: () => void;
  
  // For API calls
  paginationParams: {
    page: number;
    limit: number;
    offset: number;
  };
}

/**
 * usePagination Hook
 * Manages pagination state for lists and tables
 * 
 * @example
 * const {
 *   page, limit, total, totalPages,
 *   hasNextPage, hasPrevPage,
 *   nextPage, prevPage, setPage,
 *   paginationParams
 * } = usePagination({ initialLimit: 10 });
 * 
 * // Use in API call
 * const fetchData = async () => {
 *   const response = await api.get('/items', { params: paginationParams });
 *   setTotal(response.data.total);
 * };
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = 1,
    initialLimit = 10,
    initialTotal = 0,
  } = options;

  const [page, setPageState] = useState(initialPage);
  const [limit, setLimitState] = useState(initialLimit);
  const [total, setTotalState] = useState(initialTotal);

  // Computed values
  const totalPages = useMemo(() => Math.ceil(total / limit) || 1, [total, limit]);
  const offset = useMemo(() => (page - 1) * limit, [page, limit]);
  const hasNextPage = useMemo(() => page < totalPages, [page, totalPages]);
  const hasPrevPage = useMemo(() => page > 1, [page]);
  const isFirstPage = useMemo(() => page ===
   1, [page]);
  const isLastPage = useMemo(() => page ===
   totalPages, [page, totalPages]);

  // Generate page range for pagination UI
  const pageRange = useMemo(() => {
    const range: number[] = [];
    const maxVisible = 5;
    
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    
    // Adjust start if we're near the end
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    
    return range;
  }, [page, totalPages]);

  // Actions
  const setPage = useCallback((newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages));
    setPageState(validPage);
  }, [totalPages]);

  const setLimit = useCallback((newLimit: number) => {
    setLimitState(newLimit);
    setPageState(1); // Reset to first page when limit changes
  }, []);

  const setTotal = useCallback((newTotal: number) => {
    setTotalState(newTotal);
    // Adjust page if current page is now out of bounds
    const newTotalPages = Math.ceil(newTotal / limit) || 1;
    if (page > newTotalPages) {
      setPageState(newTotalPages);
    }
  }, [page, limit]);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPageState(prev => prev + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setPageState(prev => prev - 1);
    }
  }, [hasPrevPage]);

  const firstPage = useCallback(() => {
    setPageState(1);
  }, []);

  const lastPage = useCallback(() => {
    setPageState(totalPages);
  }, [totalPages]);

  const reset = useCallback(() => {
    setPageState(initialPage);
    setLimitState(initialLimit);
    setTotalState(initialTotal);
  }, [initialPage, initialLimit, initialTotal]);

  // Params for API calls
  const paginationParams = useMemo(() => ({
    page,
    limit,
    offset,
  }), [page, limit, offset]);

  return {
    // State
    page,
    limit,
    total,
    totalPages,
    
    // Computed
    offset,
    hasNextPage,
    hasPrevPage,
    isFirstPage,
    isLastPage,
    pageRange,
    
    // Actions
    setPage,
    setLimit,
    setTotal,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    reset,
    
    // For API calls
    paginationParams,
  };
}
