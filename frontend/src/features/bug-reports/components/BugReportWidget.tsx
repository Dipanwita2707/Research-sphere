'use client';

import React, { useState } from 'react';
import { Bug } from 'lucide-react';
import { BugReportForm } from './BugReportForm';
import { cn } from '@/lib/utils';

interface BugReportWidgetProps {
  className?: string;
}

export function BugReportWidget({ className }: BugReportWidgetProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Check feature flag - can be controlled via environment variable
  const isEnabled = process.env.NEXT_PUBLIC_BUG_REPORT_ENABLED !== 'false';

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Fixed Bug Icon Button */}
      <button
        onClick={() => setIsFormOpen(true)}
        className={cn(
          'fixed bottom-5 right-5 z-40',
          'w-14 h-14 rounded-full',
          'bg-red-600 hover:bg-red-700',
          'text-white shadow-lg hover:shadow-xl',
          'transition-all duration-200',
          'flex items-center justify-center',
          'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
          'group',
          className
        )}
        aria-label="Report a bug - Opens bug report form"
        title="Report a bug"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsFormOpen(true);
          }
        }}
      >
        <Bug className="w-6 h-6 group-hover:scale-110 transition-transform" aria-hidden="true" />
        
        {/* Pulse animation on hover */}
        <span className="absolute inset-0 rounded-full bg-red-600 opacity-0 group-hover:opacity-20 group-hover:animate-ping" aria-hidden="true" />
      </button>

      {/* Bug Report Form Modal */}
      <BugReportForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </>
  );
}
