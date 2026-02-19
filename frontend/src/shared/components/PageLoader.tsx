'use client';

/**
 * Full-page loading indicator with multi-ring animation.
 * Use for page-level loading states (e.g. auth check, initial data load).
 */
export default function PageLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm'
    : 'relative flex flex-col items-center justify-center p-12';

  return (
    <div className={containerClasses}>
      <div className="relative flex items-center justify-center">
        {/* Outer Ring - Slow Orbit */}
        <div className="absolute h-20 w-20 rounded-full border-t-2 border-l-2 border-primary-500/30 animate-[spin_3s_linear_infinite]"></div>

        {/* Middle Ring - Reverse Pulse */}
        <div className="absolute h-14 w-14 rounded-full border-b-2 border-r-2 border-primary-400/50 animate-[spin_2s_linear_infinite_reverse]"></div>

        {/* Inner Core - Breathing Glow */}
        <div className="h-6 w-6 rounded-full bg-primary-600 shadow-[0_0_15px_rgba(var(--primary-600-rgb),0.5)] animate-pulse"></div>

        {/* Subtle Decorative Dots */}
        <div className="absolute h-24 w-24 rounded-full border border-dashed border-gray-200 animate-[spin_10s_linear_infinite]"></div>
      </div>

      {/* Elegant Typography */}
      <div className="mt-8 flex flex-col items-center">
        <span className="text-sm font-medium tracking-[0.2em] uppercase text-gray-500 animate-pulse">
          Loading
        </span>
        <div className="mt-1 h-[1px] w-12 bg-gradient-to-r from-transparent via-primary-500 to-transparent"></div>
      </div>
    </div>
  );
}
