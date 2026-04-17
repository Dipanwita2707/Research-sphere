import { useState, useEffect, useCallback } from 'react';
import logger from '@/shared/utils/logger';

/**
 * useLocalStorage Hook
 * Syncs state with localStorage with automatic serialization/deserialization
 * 
 * @param key - The localStorage key
 * @param initialValue - Initial value if nothing in localStorage
 * @returns Tuple of [value, setValue, removeValue]
 * 
 * @example
 * const [theme, setTheme, removeTheme] = useLocalStorage('theme', 'light');
 * setTheme('dark');
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Get initial value from localStorage or use initialValue
  const readValue = useCallback((): T => {
    // Server-side rendering check
    if (typeof window ===
   'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      logger.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that persists to localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      // Server-side rendering check
      if (typeof window ===
   'undefined') {
        logger.warn(`Tried setting localStorage key "${key}" during SSR`);
        return;
      }

      try {
        // Allow value to be a function so we have same API as useState
        const newValue = value instanceof Function ? value(storedValue) : value;
        
        // Save to localStorage
        window.localStorage.setItem(key, JSON.stringify(newValue));
        
        // Save to state
        setStoredValue(newValue);
        
        // Dispatch a custom event so other components using this hook can sync
        window.dispatchEvent(new StorageEvent('storage', {
          key,
          newValue: JSON.stringify(newValue),
        }));
      } catch (error) {
        logger.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Remove the value from localStorage
  const removeValue = useCallback(() => {
    // Server-side rendering check
    if (typeof window ===
   'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
      
      // Dispatch a custom event so other components using this hook can sync
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: null,
      }));
    } catch (error) {
      logger.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Listen for changes in other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key ===
   key && event.newValue !== null) {
        try {
          setStoredValue(JSON.parse(event.newValue) as T);
        } catch {
          setStoredValue(initialValue);
        }
      } else if (event.key ===
   key && event.newValue ===
   null) {
        setStoredValue(initialValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue]);

  // Re-read value on mount in case it changed
  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  return [storedValue, setValue, removeValue];
}
