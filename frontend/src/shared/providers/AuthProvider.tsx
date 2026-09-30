'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { authService } from '@/shared/services/auth.service';
import AccessBlockedScreen from '@/shared/auth/AccessBlockedScreen';
import {
  ACCESS_BLOCKED_EVENT,
  AccessBlockedDetail,
  LOGIN_REASON_SESSION_ENDED,
  SESSION_ENDED_EVENT,
  SessionEndedDetail,
} from '@/shared/auth/sessionEvents';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { checkAuth, isAuthenticated, sessionExpiresAt, markActivity, logout } = useAuthStore();
  const lastActivitySyncRef = useRef(0);
  const sessionEndHandledRef = useRef(false);
  const [blocked, setBlocked] = useState<AccessBlockedDetail | null>(null);

  useEffect(() => {
    // Initialize auth state on app load
    void checkAuth();
  }, [checkAuth]);

  // A new sign-in re-arms the session-ended handler and clears any block notice
  useEffect(() => {
    if (isAuthenticated) {
      sessionEndHandledRef.current = false;
    } else {
      setBlocked(null);
    }
  }, [isAuthenticated]);

  // Server-side session/tenant failures reported by the API client
  useEffect(() => {
    const handleSessionEnded = (event: Event) => {
      const { isAuthenticated: authed, clearSession } = useAuthStore.getState();
      if (!authed || sessionEndHandledRef.current) return;
      sessionEndHandledRef.current = true;

      const detail = (event as CustomEvent<SessionEndedDetail>).detail || {};
      clearSession();
      // Best-effort: clear the (now useless) httpOnly cookie
      void authService.logout();

      if (!window.location.pathname.startsWith('/login')) {
        const params = new URLSearchParams({ reason: LOGIN_REASON_SESSION_ENDED });
        if (detail.code) params.set('code', detail.code);
        // Full navigation so no data from the ended session stays in memory
        window.location.replace(`/login?${params.toString()}`);
      }
    };

    const handleAccessBlocked = (event: Event) => {
      if (!useAuthStore.getState().isAuthenticated) return;
      const detail = (event as CustomEvent<AccessBlockedDetail>).detail;
      if (detail?.code) setBlocked(detail);
    };

    window.addEventListener(SESSION_ENDED_EVENT, handleSessionEnded);
    window.addEventListener(ACCESS_BLOCKED_EVENT, handleAccessBlocked);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, handleSessionEnded);
      window.removeEventListener(ACCESS_BLOCKED_EVENT, handleAccessBlocked);
    };
  }, []);

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

  if (blocked && isAuthenticated) {
    return (
      <AccessBlockedScreen
        code={blocked.code}
        message={blocked.message}
        onSignOut={async () => {
          await logout();
          setBlocked(null);
          window.location.replace('/login');
        }}
      />
    );
  }

  return <>{children}</>;
}
