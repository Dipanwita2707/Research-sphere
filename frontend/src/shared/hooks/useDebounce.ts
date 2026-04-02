import { useState, useEffect, useRef } from 'react';

export type UseDebounceOptions<T> = {
  /** Delay in milliseconds (default: 500ms) */
  delay?: number;
  /** Called when the debounced value settles (after delay). Use to update URL/params without useEffect. */
  onSettle?: (value: T) => void;
};

/**
 * useDebounce Hook
 * Debounces a value by the specified delay.
 * Optionally invokes onSettle when the debounced value changes, so callers can
 * update URL/params in the callback instead of syncing via useEffect.
 *
 * @param value - The value to debounce
 * @param delayOrOptions - Delay in ms, or options object with delay and onSettle
 * @returns The debounced value
 *
 * @example
 * // Basic usage (returns debounced value only)
 * const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * @example
 * // With onSettle to update params without useEffect
 * const debouncedSearch = useDebounce(searchInput, { delay: 350, onSettle: (v) => setParams({ search: v || undefined, page: undefined }) });
 */
export function useDebounce<T>(
  value: T,
  delayOrOptions: number | UseDebounceOptions<T> = 500,
): T {
  const opts = typeof delayOrOptions ===
   'number'
    ? { delay: delayOrOptions }
    : delayOrOptions;
  const { delay = 500, onSettle } = opts;
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
      onSettleRef.current?.(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback Hook
 * Returns a debounced version of the callback
 * 
 * @param callback - The callback to debounce
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns A debounced callback
 * 
 * @example
 * const handleSearch = useDebouncedCallback((term: string) => {
 *   fetchResults(term);
 * }, 300);
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clean up on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  };
}
