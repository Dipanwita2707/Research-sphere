'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/shared/auth/authStore';
import api from '@/shared/api/api';
import ResearchContributionForm from '@/features/research-management/components/ResearchContributionForm';
import ResearchTypeSelector from '@/features/research-management/components/ResearchTypeSelector';
import logger from '@/shared/utils/logger';

export default function ResearchApplyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get('type');
  const editId = searchParams.get('edit'); // Get edit parameter for editing existing drafts
  const trackerId = searchParams.get('trackerId'); // Get trackerId for filing from tracker
  const { user } = useAuthStore();
  const [canFileResearch, setCanFileResearch] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkFilePermission();
  }, [user]);

  const checkFilePermission = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Get role name
    const roleName = typeof user.role === 'object' ? user.role?.name : user.userType;
    
    // Faculty and Student have inherent research filing rights
    if (roleName === 'faculty' || roleName === 'student') {
      setCanFileResearch(true);
      setLoading(false);
      return;
    }
    
    // Staff/Admin need to check for explicit research_file_new permission
    try {
      const response = await api.get('/dashboard/staff');
      if (response.data.success && response.data.data.permissions) {
        const hasPermission = response.data.data.permissions.some((dept: any) => {
          return dept.permissions?.some((p: string) => {
            const pLower = p.toLowerCase();
            return pLower === 'research_file_new';
          });
        });
        setCanFileResearch(hasPermission);
      } else {
        setCanFileResearch(false);
      }
    } catch (error) {
      logger.error('Error checking file permission:', error);
      setCanFileResearch(false);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (canFileResearch === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center border dark:border-gray-700">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You do not have permission to file research contributions.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // No type selected - show type selector
  if (!type) {
    return <ResearchTypeSelector />;
  }

  // Redirect grant_proposal to the dedicated grant application page
  if (type === 'grant_proposal') {
    router.replace(editId ? `/research/apply-grant?edit=${editId}` : '/research/apply-grant');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400"></div>
      </div>
    );
  }

  // Valid type - show form
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Back Button */}
        <Link
          href="/research/apply"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Type Selection
        </Link>

        <ResearchContributionForm 
          publicationType={type as any}
          contributionId={editId || undefined}
          trackerId={trackerId || undefined}
          onSuccess={() => router.push('/research/my-contributions')}
        />
      </div>
    </div>
  );
}
