import React from 'react';
import { PageHeaderSkeleton, StatsCardSkeleton, CardSkeleton } from '@/components/skeletons';

export default function DswLoading() {
    return (
        <div className="space-y-6">
            <PageHeaderSkeleton />
            <StatsCardSkeleton count={4} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
                <div className="space-y-4">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        </div>
    );
}
