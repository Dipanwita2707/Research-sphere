'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import { Loader2 } from 'lucide-react';

/**
 * DRD Analytics Person Page - Redirects to Research Profile
 * 
 * This page automatically redirects to the unified research profile page
 * which includes all DRD analytics data in the "Comprehensive Analytics" tab.
 */
export default function ApplicantProfilePage() {
  const router = useRouter();
  const params = useParams<{ personId: string }>();
  const personId = params?.personId ?? null;

  // Redirect to research profile page immediately
  useEffect(() => {
    if (personId) {
      router.replace(`/research/profile/${personId}`);
    }
  }, [personId, router]);

  // Show loading while redirecting
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f6] p-6 dark:bg-gray-900">
        <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 text-center shadow-[0_1px_2px_rgba(28,25,23,0.04)] dark:border-gray-700 dark:bg-gray-800">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-wine dark:text-amber" aria-hidden="true" />
          <h2 className="mb-1.5 text-base font-semibold text-stone-900 dark:text-gray-100">Opening research profile</h2>
          <p className="text-sm text-stone-500 dark:text-gray-400">
            Analytics for this person now live on their research profile.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}

