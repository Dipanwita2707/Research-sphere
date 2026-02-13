'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function VolunteersRedirect() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  useEffect(() => {
    // Redirect to the new Event Management page, Volunteers tab
    router.replace(`/events/${eventId}/management`);
  }, [eventId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-sgt-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">Redirecting to Event Management...</p>
      </div>
    </div>
  );
}
