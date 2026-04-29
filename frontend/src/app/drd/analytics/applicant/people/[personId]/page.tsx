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
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border">
          <Loader2 className="w-10 h-10 text-blue-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Redirecting...</h2>
          <p className="text-gray-500 text-sm">
            Taking you to the research profile page.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}

