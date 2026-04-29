'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BugReportSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  debounceMs?: number;
}

export function BugReportSearch({ searchTerm, onSearchChange, debounceMs = 300 }: BugReportSearchProps) {
  const [localValue, setLocalValue] = useState(searchTerm);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== searchTerm) {
        onSearchChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, searchTerm, onSearchChange, debounceMs]);

  // Sync with external changes
  useEffect(() => {
    setLocalValue(searchTerm);
  }, [searchTerm]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onSearchChange('');
  }, [onSearchChange]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
        <Input
          type="search"
          placeholder="Search by user, description, or page URL..."
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className={cn('pl-10 pr-10', localValue && 'pr-10')}
          aria-label="Search bug reports"
          role="searchbox"
        />
        {localValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
