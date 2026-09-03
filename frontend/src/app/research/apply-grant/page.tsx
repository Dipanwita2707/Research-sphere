'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/shared/auth/authStore';
import api from '@/shared/api/api';
import GrantApplicationForm from '@/features/research-management/components/GrantApplicationForm';
import logger from '@/shared/utils/logger';

export default function GrantApplyPage() {
  const searchParams = useSearchParams()!;
  const router = useRouter();
  const editId = searchParams.get('edit');
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
    const roleName = typeof user.role ===
   'object' ? user.role?.name : user.userType;
    
    // Faculty and Student have inherent research filing rights
    if (roleName ===
   'faculty' || roleName ===
   'student') {
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
            return pLower ===
   'research_file_new' || pLower ===
   'grant_file_new';
          });
        });
        setCanFileResearch(hasPermission);
      } else {
        setCanFileResearch(false);
      }
    } catch (error) {
      logger.error('Error checking permissions:', error);
      setCanFileResearch(false);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf5ec] dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                <div className="h-10 w-full bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
              </div>
            ))}
            <div className="h-10 w-32 bg-orange-100 rounded-lg animate-pulse mt-4" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fdf5ec] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold dark:text-white mb-2">Authentication Required</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to submit a grant application.</p>
          <Link href="/login" className="text-orange-600 hover:text-orange-700 font-medium">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (!canFileResearch) {
    return (
      <div className="min-h-screen bg-[#fdf5ec] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold dark:text-white mb-2">Access Restricted</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don&apos;t have permission to submit grant applications. 
            Please contact your administrator if you believe this is an error.
          </p>
          <Link href="/research" className="text-orange-600 hover:text-orange-700 font-medium">
            Back to Research
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5ec] dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Back Button */}
        <Link 
          href="/research/apply" 
          className="inline-flex items-center gap-2 px-4 py-2 border border-[#f0e2d2] rounded-xl bg-white text-sm font-semibold text-gray-700 hover:text-[#7d1a34] hover:bg-[#fbe2e8]/20 shadow-sm transition-all duration-200 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Research Types
        </Link>
        
        {/* Form */}
        <GrantApplicationForm 
          grantId={editId || undefined}
          onSuccess={() => router.push('/research/my-contributions')}
        />
      </div>
    </div>
  );
}
