/**
 * Shared Page Skeleton Component
 * Shows layout placeholder while content loads - improves perceived performance
 */

interface PageSkeletonProps {
  message?: string;
  className?: string;
}

export function PageSkeleton({ message = 'Loading...', className = '' }: PageSkeletonProps) {
  return (
    <div
      className={`flex items-center justify-center min-h-[400px] ${className}`}
      role="status"
      aria-label={message}
    >
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}

export default PageSkeleton;
