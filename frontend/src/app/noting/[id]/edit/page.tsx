'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

/**
 * Edit draft is handled by the same page as create: /noting/new.
 * This route redirects so old links and bookmarks still work.
 */
export default function EditDraftRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    if (id) router.replace(`/noting/new?draft=${encodeURIComponent(id)}`);
  }, [id, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <Skeleton className="w-8 h-8 rounded-sm" />
    </div>
  );
}
