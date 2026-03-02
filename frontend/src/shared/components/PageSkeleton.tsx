/**
 * Shared Page Skeleton Component
 * Shows layout placeholder while content loads - improves perceived performance
 */

import { CardSkeleton } from '@/components/skeletons';

interface PageSkeletonProps {
  message?: string;
  className?: string;
}

export function PageSkeleton({ message = 'Loading...', className = '' }: PageSkeletonProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[400px] gap-6 w-full ${className}`}
      role="status"
      aria-label={message}
    >
      <div className="w-full max-w-sm">
        <CardSkeleton />
        <p className="text-center text-gray-500 dark:text-gray-400 mt-4 text-sm font-medium animate-pulse">{message}</p>
      </div>
    </div>
  );
}

export default PageSkeleton;
