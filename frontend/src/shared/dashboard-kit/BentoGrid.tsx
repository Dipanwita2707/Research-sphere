'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * 4-column responsive grid (2 cols on mobile, 4 on desktop). Children use
 * `BentoItem` (or raw `col-span-*` / `row-span-*` classes) to size themselves.
 */
export default function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-min', className)}>
      {children}
    </div>
  );
}

interface BentoItemProps {
  children: ReactNode;
  className?: string;
  /** Column span at the lg breakpoint (out of 4). Defaults to 1. */
  span?: 1 | 2 | 3 | 4;
  /** Column span on mobile (out of 2). Defaults to 2 (full width). */
  spanMobile?: 1 | 2;
}

const spanClasses: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
};

const spanMobileClasses: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
};

export function BentoItem({ children, className, span = 1, spanMobile = 2 }: BentoItemProps) {
  return (
    <div className={cn(spanMobileClasses[spanMobile], spanClasses[span], className)}>
      {children}
    </div>
  );
}
