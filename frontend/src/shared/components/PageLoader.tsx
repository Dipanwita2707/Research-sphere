'use client';

import Wordmark from '@/shared/components/brand/Wordmark';

export default function PageLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FDF5EC] dark:bg-gray-950 transition-colors duration-200'
    : 'relative flex flex-col items-center justify-center p-12 bg-[#FDF5EC] dark:bg-gray-950/20 rounded-2xl';

  return (
    <div className={containerClasses}>
      <style jsx global>{`
        @keyframes orbit-1 {
          0% { transform: rotate3d(1, 1, 1, 0deg); }
          100% { transform: rotate3d(1, 1, 1, 360deg); }
        }
        @keyframes orbit-2 {
          0% { transform: rotate3d(1, -1, 1, 0deg); }
          100% { transform: rotate3d(1, -1, 1, 360deg); }
        }
        @keyframes orbit-3 {
          0% { transform: rotate3d(-1, 1, 1, 0deg); }
          100% { transform: rotate3d(-1, 1, 1, 360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(0.9); opacity: 0.7; box-shadow: 0 0 12px rgba(132, 28, 67, 0.4); }
          50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 24px rgba(226, 139, 34, 0.6); }
        }
        .orbit-ring-1 {
          animation: orbit-1 3s linear infinite;
        }
        .orbit-ring-2 {
          animation: orbit-2 2.5s linear infinite;
        }
        .orbit-ring-3 {
          animation: orbit-3 2s linear infinite;
        }
        .pulse-core {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>

      <div className="relative flex items-center justify-center w-32 h-32">
        {/* Decorative outer glow ring */}
        <div className="absolute inset-0 rounded-full border border-peach/30 scale-110 pointer-events-none" />

        {/* Orbit Ring 1 - Wine */}
        <div className="absolute w-24 h-24 rounded-full border-2 border-dashed border-wine/40 orbit-ring-1" />

        {/* Orbit Ring 2 - Amber */}
        <div className="absolute w-20 h-20 rounded-full border-2 border-dotted border-amber/50 orbit-ring-2" />

        {/* Orbit Ring 3 - Peach */}
        <div className="absolute w-16 h-16 rounded-full border border-wine/30 orbit-ring-3" />

        {/* Center Nucleus / Core */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-wine to-amber pulse-core" />
      </div>

      {/* Elegant Typography & Brand Identity */}
      <div className="mt-8 flex flex-col items-center select-none">
        <Wordmark heightClassName="h-10 opacity-80" />
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-wine dark:text-amber mt-4 animate-pulse">
          Initializing Workspace
        </span>
      </div>
    </div>
  );
}
