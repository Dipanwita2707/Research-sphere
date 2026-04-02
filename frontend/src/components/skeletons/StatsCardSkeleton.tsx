import React from 'react';
import { Skeleton } from './Skeleton';

interface StatsCardSkeletonProps {
    className?: string;
    count?: number;
}

export function StatsCardSkeleton({ className = "", count = 4 }: StatsCardSkeletonProps) {
    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(count, 4)} gap-4 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={`stat-${i}`} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-6 w-16" />
                    </div>
                </div>
            ))}
        </div>
    );
}
