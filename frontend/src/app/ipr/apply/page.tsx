'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import IPRIdeaRequestForm from '@/features/ipr-management/components/IPRIdeaRequestForm';
import IPRTypeSelector from '@/features/ipr-management/components/IPRTypeSelector';
import { useAuthStore } from '@/shared/auth/authStore';
import api from '@/shared/api/api';
import logger from '@/shared/utils/logger';

export default function DynamicIPRPage() {
  const searchParams = useSearchParams()!;
  const router = useRouter();
  const type = searchParams.get('type');
  const { user } = useAuthStore();
  const [canFileIpr, setCanFileIpr] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkFilePermission();
  }, [user]);

  const checkFilePermission = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Get role name - role can be an object { name, displayName } or userType is the role string
    const roleName = typeof user.role ===
   'object' ? user.role?.name : user.userType;
    
    // Faculty and Student have inherent IPR filing rights
    if (roleName ===
   'faculty' || roleName ===
   'student') {
      setCanFileIpr(true);
      setLoading(false);
      return;
    }
    
    // Staff/Admin need to check for explicit ipr_file_new permission
    try {
      const response = await api.get('/dashboard/staff');
      if (response.data.success && response.data.data.permissions) {
        const hasPermission = response.data.data.permissions.some((dept: any) => {
          return dept.permissions?.some((p: string) => {
            const pLower = p.toLowerCase();
            // Check for exact ipr_file_new permission
            return pLower ===
   'ipr_file_new' || 
                   pLower ===
   'ipr_file' || 
                   pLower ===
   'drd_ipr_file';
          });
        });
        setCanFileIpr(hasPermission);
      } else {
        setCanFileIpr(false);
      }
    } catch (error) {
      logger.error('Error checking file permission:', error);
      setCanFileIpr(false);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (canFileIpr ===
   false) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center border dark:border-gray-700">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You do not have permission to file IPR applications. 
              {((typeof user?.role ===
   'object' ? user?.role?.name : user?.userType) ===
   'staff' || 
                (typeof user?.role ===
   'object' ? user?.role?.name : user?.userType) ===
   'admin') && (
                <span className="block mt-2 text-sm">
                  {(typeof user?.role ===
   'object' ? user?.role?.name : user?.userType) ===
   'admin' 
                    ? 'Admin accounts manage users and permissions. To file IPR, you need the "File New IPR Applications" permission assigned.'
                    : 'Staff members require the "File New IPR Applications" permission from an administrator.'}
                </span>
              )}
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      {type ? (
        <IPRIdeaRequestForm initialType={type as 'patent' | 'copyright' | 'design' | 'trademark'} />
      ) : (
        <IPRTypeSelector />
      )}
    </ProtectedRoute>
  );
}