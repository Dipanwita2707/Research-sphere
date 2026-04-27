'use client';

import React, { useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/shared/auth/authStore';
import { BugReportDetail as BugReportDetailComponent } from '../components/BugReportDetail';
import { useBugReportQuery, useUpdateBugReportStatus } from '@/features/bug-reports/hooks/useBugReportsQuery';

export default function BugReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const id = params?.id as string;

  // Check if user is admin
  const isAdmin = user && (user.userType === 'admin' || user.role?.name === 'superadmin');

  useEffect(() => {
    if (user && !isAdmin) {
      router.push('/dashboard');
    }
  }, [user, isAdmin, router]);

  // Use React Query for data fetching with caching
  const { data: report, isLoading, error: queryError } = useBugReportQuery(id, {
    enabled: !!isAdmin && !!id,
  });

  // Use mutation for status updates with automatic cache invalidation
  const updateStatusMutation = useUpdateBugReportStatus();

  const handleBack = useCallback(() => {
    router.push('/admin/bug-reports');
  }, [router]);

  const handleStatusUpdate = useCallback(
    async (status: 'resolved' | 'unresolved') => {
      if (!report) return;

      try {
        await updateStatusMutation.mutateAsync({ id: report.id, status });
      } catch (err) {
        console.error('Failed to update bug report status:', err);
        alert('Failed to update status. Please try again.');
      }
    },
    [report, updateStatusMutation]
  );

  const error = queryError
    ? (queryError as any).response?.status === 404
      ? 'Bug report not found'
      : (queryError as any).response?.status === 403
      ? 'You do not have permission to view this bug report'
      : 'Failed to load bug report. Please try again.'
    : null;

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bug Reports
        </Button>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Bug Report Detail */}
        {!isLoading && !error && report && (
          <BugReportDetailComponent report={report} onStatusUpdate={handleStatusUpdate} />
        )}
      </div>
    </div>
  );
}
