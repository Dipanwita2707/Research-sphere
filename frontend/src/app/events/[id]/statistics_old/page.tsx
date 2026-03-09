'use client';

import { useEffect } from 'react';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function StatisticsRedirect() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  useEffect(() => {
    // Redirect to the new Event Management page
    router.replace(`/events/${eventId}/management`);
  }, [eventId, router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <CardSkeleton className="w-full max-w-sm mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">Redirecting to Event Management...</p>
      </div>
    </div>
  );
}
