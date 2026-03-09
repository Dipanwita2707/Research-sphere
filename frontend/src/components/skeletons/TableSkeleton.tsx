import React from 'react';
import { Skeleton } from './Skeleton';

interface TableSkeletonProps {
    columns?: number;
    rows?: number;
    className?: string;
}

export function TableSkeleton({ columns = 5, rows = 5, className = "" }: TableSkeletonProps) {
    return (
        <div className={`w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={`th-${i}`} className="px-6 py-4">
                                <Skeleton className="h-4 w-20" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <tr key={`tr-${rowIndex}`} className="border-t border-gray-200 dark:border-gray-700">
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <td key={`td-${rowIndex}-${colIndex}`} className="px-6 py-4">
                                    <Skeleton className="h-4 w-full max-w-[80%]" />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
