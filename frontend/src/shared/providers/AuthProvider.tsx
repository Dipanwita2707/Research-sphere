'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { checkAuth, isAuthenticated, sessionExpiresAt, markActivity, logout } = useAuthStore();
  const lastActivitySyncRef = useRef(0);

  useEffect(() => {
    // Initialize auth state on app load
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const syncActivity = () => {
      const now = Date.now();
      if (now - lastActivitySyncRef.current < 60_000) {
        return;
      }

      lastActivitySyncRef.current = now;
      markActivity();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncActivity();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousedown', 'scroll', 'touchstart'];

    syncActivity();
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, syncActivity, { passive: true });
    });
    window.addEventListener('focus', syncActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, syncActivity);
      });
      window.removeEventListener('focus', syncActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, markActivity]);

  useEffect(() => {
    if (!isAuthenticated || !sessionExpiresAt) {
      return;
    }

    const remainingMs = sessionExpiresAt - Date.now();
    if (remainingMs <= 0) {
      void logout();
      return;
    }

    const timerId = window.setTimeout(() => {
      void logout();
    }, remainingMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isAuthenticated, logout, sessionExpiresAt]);

  return <>{children}</>;
}