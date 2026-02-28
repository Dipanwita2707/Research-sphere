import React from 'react';
import { Skeleton } from './Skeleton';

export function ModalSkeleton({ className = "" }: { className?: string }) {
    return (
        <div className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm ${className}`}>
            <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl">
                <div className="flex justify-between items-start mb-5">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>

                <div className="space-y-4 py-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[90%]" />
                    <Skeleton className="h-4 w-[95%]" />
                    <Skeleton className="h-32 w-full mt-4" />
                </div>

                <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                </div>
            </div>
        </div>
    );
}
