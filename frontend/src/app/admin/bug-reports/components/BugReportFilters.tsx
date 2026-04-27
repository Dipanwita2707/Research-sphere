'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResolutionStatus } from '@/features/bug-reports/types/bugReport.types';

interface BugReportFiltersProps {
  currentStatus: 'all' | ResolutionStatus;
  onStatusChange: (status: 'all' | ResolutionStatus) => void;
  unresolvedCount: number;
}

export function BugReportFilters({ currentStatus, onStatusChange, unresolvedCount }: BugReportFiltersProps) {
  const filters = [
    {
      value: 'all' as const,
      label: 'All Reports',
      icon: List,
      color: 'text-gray-600',
    },
    {
      value: 'unresolved' as const,
      label: 'Unresolved',
      icon: Clock,
      color: 'text-orange-600',
      badge: unresolvedCount,
    },
    {
      value: 'resolved' as const,
      label: 'Resolved',
      icon: CheckCircle,
      color: 'text-green-600',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter bug reports by status">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = currentStatus === filter.value;

        return (
          <Button
            key={filter.value}
            size="sm"
            variant={isActive ? 'default' : 'outline'}
            onClick={() => onStatusChange(filter.value)}
            className={cn('relative whitespace-nowrap', !isActive && 'hover:bg-gray-50')}
            aria-pressed={isActive}
            aria-label={`Filter by ${filter.label}${filter.badge !== undefined ? `, ${filter.badge} unresolved` : ''}`}
          >
            <Icon className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5', isActive ? 'text-white' : filter.color)} aria-hidden="true" />
            <span className="text-xs sm:text-sm">{filter.label}</span>
            {filter.badge !== undefined && filter.badge > 0 && (
              <span
                className={cn(
                  'ml-1.5 sm:ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium',
                  isActive ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'
                )}
                aria-label={`${filter.badge} unresolved reports`}
              >
                {filter.badge}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
