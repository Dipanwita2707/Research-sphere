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
  const searchParams = useSearchParams();
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to submit a grant application.</p>
          <Link href="/login" className="text-orange-600 hover:text-orange-700 font-medium">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (!canFileResearch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-4">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link 
            href="/research/apply" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Research Types
          </Link>
        </div>
      </div>
      
      {/* Form */}
      <GrantApplicationForm 
        grantId={editId || undefined}
        onSuccess={() => router.push('/research/my-contributions')}
      />
    </div>
  );
}
