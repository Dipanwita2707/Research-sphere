import React from 'react';
import { Skeleton } from './Skeleton';

export function PageHeaderSkeleton({ className = "" }: { className?: string }) {
    return (
        <div className={`space-y-4 mb-6 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="flex space-x-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
        </div>
    );
}
