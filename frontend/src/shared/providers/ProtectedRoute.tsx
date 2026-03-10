'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/authStore';
import { logger } from '@/shared/utils/logger';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Only check auth if we don't have a user and aren't already loading
    const initAuth = async () => {
      // If already authenticated with user data, skip the check
      if (isAuthenticated && user) {
        logger.debug('ProtectedRoute - Already authenticated with user');
        setIsInitialized(true);
        return;
      }
      
      // Otherwise, verify auth status
      await checkAuth();
      setIsInitialized(true);
    };
    
    if (!isInitialized && !isLoading) {
      initAuth();
    }
  }, [checkAuth, isInitialized, isLoading, isAuthenticated, user]);

  useEffect(() => {
    if (isInitialized && !isLoading && !isAuthenticated) {
      if (hasRedirectedRef.current) {
        return;
      }

      hasRedirectedRef.current = true;
      logger.warn('ProtectedRoute - Not authenticated, redirecting to login', {
        isInitialized,
        isLoading,
        isAuthenticated,
        hasUser: !!user
      });
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, isInitialized, router, user]);

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
