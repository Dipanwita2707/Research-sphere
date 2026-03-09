/**
 * Shared Loading Spinner Component
 * Consistent loading indicator across the application
 */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export default LoadingSpinner;
