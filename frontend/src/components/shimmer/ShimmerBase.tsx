'use client';

import React from 'react';

/**
 * Base Shimmer component with gradient animation
 * Uses a smooth gradient animation that moves from left to right
 */
export interface ShimmerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional Tailwind classes */
  className?: string;
  /** Whether to use rounded corners */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function Shimmer({ 
  className = '', 
  rounded = 'md',
  ...props 
}: ShimmerProps) {
  const roundedClass = rounded === 'none' ? '' : `rounded-${rounded}`;
  
  return (
    <div
      className={`
        shimmer-animate
        bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200
        dark:from-gray-700 dark:via-gray-600 dark:to-gray-700
        bg-[length:200%_100%]
        ${roundedClass}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    />
  );
}

/** Line shimmer - for text placeholders */
export function ShimmerLine({ 
  width = 'full', 
  height = '4',
  className = '' 
}: { 
  width?: string; 
  height?: string;
  className?: string;
}) {
  const widthClass = width === 'full' ? 'w-full' : `w-${width}`;
  const heightClass = `h-${height}`;
  return <Shimmer className={`${heightClass} ${widthClass} ${className}`} />;
}

/** Circle shimmer - for avatars */
export function ShimmerCircle({ 
  size = '12',
  className = '' 
}: { 
  size?: string;
  className?: string;
}) {
  return <Shimmer className={`h-${size} w-${size} ${className}`} rounded="full" />;
}

/** Rectangle shimmer - for images, cards, etc */
export function ShimmerRect({ 
  width = 'full', 
  height = '32',
  className = '' 
}: { 
  width?: string; 
  height?: string;
  className?: string;
}) {
  const widthClass = width === 'full' ? 'w-full' : `w-${width}`;
  const heightClass = `h-${height}`;
  return <Shimmer className={`${heightClass} ${widthClass} ${className}`} rounded="lg" />;
}

/** Button shimmer - for action buttons */
export function ShimmerButton({ 
  width = '24', 
  size = 'md',
  className = '' 
}: { 
  width?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const heightMap = { sm: 'h-8', md: 'h-10', lg: 'h-12' };
  const widthClass = `w-${width}`;
  return <Shimmer className={`${heightMap[size]} ${widthClass} ${className}`} rounded="lg" />;
}

/** Badge shimmer - for status badges */
export function ShimmerBadge({ 
  width = '16',
  className = '' 
}: { 
  width?: string;
  className?: string;
}) {
  return <Shimmer className={`h-6 w-${width} ${className}`} rounded="full" />;
}

/** Icon shimmer - for icons */
export function ShimmerIcon({ 
  size = '5',
  className = '' 
}: { 
  size?: string;
  className?: string;
}) {
  return <Shimmer className={`h-${size} w-${size} ${className}`} rounded="md" />;
}

/** Input field shimmer */
export function ShimmerInput({ 
  className = '' 
}: { 
  className?: string;
}) {
  return <Shimmer className={`h-10 w-full ${className}`} rounded="lg" />;
}

/** Textarea shimmer */
export function ShimmerTextarea({ 
  rows = 4,
  className = '' 
}: { 
  rows?: number;
  className?: string;
}) {
  const height = rows * 24;
  return <Shimmer className={`w-full ${className}`} rounded="lg" style={{ height: `${height}px` }} />;
}

/** Table row shimmer */
export function ShimmerTableRow({ 
  columns = 5,
  className = '' 
}: { 
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 p-4 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <Shimmer 
          key={i} 
          className={`h-4 ${i === 0 ? 'w-8' : 'flex-1'}`} 
        />
      ))}
    </div>
  );
}

/** Card container with shimmer styling */
export function ShimmerCard({ 
  children, 
  className = '' 
}: { 
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`
      rounded-2xl border border-gray-200 bg-white p-6 
      shadow-[0_2px_12px_rgba(0,91,150,0.08)]
      dark:border-gray-700 dark:bg-gray-800 
      ${className}
    `}>
      {children ?? (
        <div className="space-y-4">
          <Shimmer className="h-6 w-3/4" />
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-5/6" />
        </div>
      )}
    </div>
  );
}

/** Stats card shimmer */
export function ShimmerStatCard({ className = '' }: { className?: string }) {
  return (
    <ShimmerCard className={className}>
      <div className="flex items-center gap-4">
        <Shimmer className="h-12 w-12" rounded="xl" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-7 w-16" />
          <Shimmer className="h-4 w-24" />
        </div>
      </div>
    </ShimmerCard>
  );
}

/** Tab shimmer */
export function ShimmerTabs({ 
  count = 4,
  className = '' 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} className="h-10 w-28" rounded="lg" />
      ))}
    </div>
  );
}

/** Search bar shimmer */
export function ShimmerSearchBar({ 
  showButton = true,
  className = '' 
}: { 
  showButton?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Shimmer className="h-10 flex-1" rounded="lg" />
      {showButton && <Shimmer className="h-10 w-24" rounded="lg" />}
    </div>
  );
}

/** Filter section shimmer */
export function ShimmerFilters({ 
  count = 4,
  className = '' 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Shimmer className="h-4 w-20" />
          <Shimmer className="h-10 w-full" rounded="lg" />
        </div>
      ))}
    </div>
  );
}

/** Pagination shimmer */
export function ShimmerPagination({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <Shimmer className="h-10 w-24" rounded="lg" />
      <Shimmer className="h-6 w-20" />
      <Shimmer className="h-10 w-24" rounded="lg" />
    </div>
  );
}
