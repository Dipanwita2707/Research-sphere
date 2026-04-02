'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/authStore';
import { logger } from '@/shared/utils/logger';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore();
  // Lazy init: if auth is already in store, skip spinner entirely
  const [isInitialized, setIsInitialized] = useState(() => !!(isAuthenticated && user));

  useEffect(() => {
    if (isInitialized) return; // already done synchronously
    const initAuth = async () => {
      if (isAuthenticated && user) {
        logger.debug('ProtectedRoute - Already authenticated with user');
        setIsInitialized(true);
        return;
      }
      await checkAuth();
      setIsInitialized(true);
    };
    if (!isLoading) {
      initAuth();
    }
  }, [checkAuth, isInitialized, isLoading, isAuthenticated, user]);

  useEffect(() => {
    if (isInitialized && !isLoading && !isAuthenticated) {
      logger.debug('ProtectedRoute - Not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, isInitialized, router]);

  if (!isInitialized || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
