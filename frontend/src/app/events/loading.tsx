import React from 'react';
import { PageHeaderSkeleton, CardSkeleton, TableSkeleton } from '@/components/skeletons';

export default function EventsLoading() {
    return (
        <div className="space-y-6">
            <PageHeaderSkeleton />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
            <TableSkeleton rows={5} columns={5} />
        </div>
    );
}
