'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import NavigationHeader from '@/shared/layouts/NavigationHeader';
import { useAuthStore } from '@/shared/auth/authStore';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();

  // Validate superadmin access
  useEffect(() => {
    if (user) {
      const roleName = user.role?.name?.toLowerCase() || user.userType?.toLowerCase();
      if (roleName !== 'superadmin') {
        router.push('/dashboard');
      }
    }
  }, [user, router]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-blush dark:bg-gray-950 transition-colors duration-200 flex flex-col overflow-x-hidden">
        <NavigationHeader />
        <main className="pt-20 sm:pt-[5.5rem] flex-1 bg-blush dark:bg-gray-950">
          <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
