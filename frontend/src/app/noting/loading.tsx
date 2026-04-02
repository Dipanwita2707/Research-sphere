import React from 'react';
import { PageHeaderSkeleton, StatsCardSkeleton, TableSkeleton } from '@/components/skeletons';

export default function NotingLoading() {
    return (
        <div className="space-y-6">
            <PageHeaderSkeleton />
            <StatsCardSkeleton count={4} />
            <TableSkeleton rows={5} columns={6} />
        </div>
    );
}
