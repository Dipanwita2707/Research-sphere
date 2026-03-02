import React from 'react';
import { Skeleton } from './Skeleton';

interface FormSkeletonProps {
    fields?: number;
    className?: string;
}

export function FormSkeleton({ fields = 4, className = "" }: FormSkeletonProps) {
    return (
        <div className={`space-y-6 max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-100 dark:bg-gray-900 dark:border-gray-800 ${className}`}>
            <div className="space-y-2 mb-8">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
            </div>

            <div className="space-y-5">
                {Array.from({ length: fields }).map((_, i) => (
                    <div key={`field-${i}`} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ))}
            </div>

            <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100 dark:border-gray-800 mt-8">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
    );
}
