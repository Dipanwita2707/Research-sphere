'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/authStore';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export default function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, checkAuth } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      if (isAuthenticated && user) {
        setIsInitialized(true);
        return;
      }

      await checkAuth();
      setIsInitialized(true);
    };

    if (!isInitialized && !isLoading) {
      void init();
    }
  }, [checkAuth, isAuthenticated, isInitialized, isLoading, user]);

  const roleName = String(
    user?.role?.name || (typeof user?.role === 'string' ? user.role : '') || user?.userType || '',
  ).toLowerCase();
  const isAdmin = roleName === 'admin' || roleName === 'superadmin';

  useEffect(() => {
    if (!isInitialized || isLoading || hasRedirectedRef.current) {
      return;
    }

    if (!isAuthenticated) {
      hasRedirectedRef.current = true;
      router.replace('/login');
      return;
    }

    if (!isAdmin) {
      hasRedirectedRef.current = true;
      router.replace('/events');
    }
  }, [isAdmin, isAuthenticated, isInitialized, isLoading, router]);

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ev-700" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
