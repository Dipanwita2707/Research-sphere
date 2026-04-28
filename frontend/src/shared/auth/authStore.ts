import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, User } from '@/shared/services/auth.service';
import { logger } from '@/shared/utils/logger';

let authCheckInFlight: Promise<void> | null = null;
export const AUTH_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const getSessionExpiry = (timestamp = Date.now()) => timestamp + AUTH_INACTIVITY_TIMEOUT_MS;
const isSessionExpiredAt = (sessionExpiresAt: number | null) =>
  typeof sessionExpiresAt === 'number' && sessionExpiresAt <= Date.now();

const clearedAuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  lastActivityAt: null,
  sessionExpiresAt: null,
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastActivityAt: number | null;
  sessionExpiresAt: number | null;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getToken: () => string | null;
  markActivity: () => void;
  isSessionExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      lastActivityAt: null,
      sessionExpiresAt: null,

      setUser: (user) => {
        logger.debug('AuthStore - setUser called with:', user);
        if (!user) {
          set({ ...clearedAuthState });
          return;
        }

        const timestamp = Date.now();
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          lastActivityAt: timestamp,
          sessionExpiresAt: getSessionExpiry(timestamp),
        });
      },

      getToken: () => get().token ?? null,

      markActivity: () => {
        const state = get();
        if (!state.isAuthenticated) {
          return;
        }

        const timestamp = Date.now();
        set({
          lastActivityAt: timestamp,
          sessionExpiresAt: getSessionExpiry(timestamp),
        });
      },

      isSessionExpired: () => isSessionExpiredAt(get().sessionExpiresAt),

      login: async (username, password) => {
        logger.debug('AuthStore - login started');
        try {
          const response = await authService.login({ username, password });
          logger.debug('AuthStore - login response:', response);
          const token = (response as { token?: string }).token ?? null;
          const timestamp = Date.now();
          set({
            user: response.user,
            token,
            isAuthenticated: true,
            isLoading: false,
            lastActivityAt: timestamp,
            sessionExpiresAt: getSessionExpiry(timestamp),
          });
          logger.debug('AuthStore - state after login:', get());
        } catch (error) {
          logger.error('AuthStore - login error:', error);
          set({ ...clearedAuthState });
          throw error;
        }
      },

      logout: async () => {
        logger.debug('AuthStore - logout');
        try {
          await authService.logout();
        } finally {
          set({ ...clearedAuthState });
        }
      },

      checkAuth: async () => {
        if (authCheckInFlight) {
          logger.debug('AuthStore - Reusing in-flight auth check');
          return authCheckInFlight;
        }

        const state = get();
        if (isSessionExpiredAt(state.sessionExpiresAt)) {
          logger.debug('AuthStore - Session expired locally, clearing persisted auth state');
          authCheckInFlight = (async () => {
            set({ isLoading: true });
            try {
              await authService.logout();
            } catch (error) {
              logger.warn('AuthStore - logout after inactivity expiry failed:', error);
            } finally {
              set({ ...clearedAuthState });
              authCheckInFlight = null;
            }
          })();

          return authCheckInFlight;
        }

        if (state.user && state.isAuthenticated) {
          logger.debug('AuthStore - Using persisted auth state for user:', state.user.username);
          set({ isLoading: false });
          return;
        }
        
        // Only check with server if we don't have persisted state
        logger.debug('AuthStore - No persisted auth, checking with server');
        authCheckInFlight = (async () => {
          set({ isLoading: true });
          try {
            const user = await authService.getCurrentUser();
            logger.debug('AuthStore - user fetched from server:', user);
            const timestamp = Date.now();
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              lastActivityAt: timestamp,
              sessionExpiresAt: getSessionExpiry(timestamp),
            });
          } catch (error: any) {
            logger.error('AuthStore - checkAuth error:', error);
            logger.error('AuthStore - Error details:', {
              message: error.message,
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data
            });
            set({ ...clearedAuthState });
          } finally {
            authCheckInFlight = null;
          }
        })();

        return authCheckInFlight;
      },

      refreshUser: async () => {
        logger.debug('AuthStore - refreshUser: Fetching fresh user data from server');
        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser();
          logger.debug('AuthStore - refreshUser: Fresh user data received:', user);
          const timestamp = Date.now();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            lastActivityAt: timestamp,
            sessionExpiresAt: getSessionExpiry(timestamp),
          });
        } catch (error) {
          logger.error('AuthStore - refreshUser error:', error);
          set({ ...clearedAuthState });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        lastActivityAt: state.lastActivityAt,
        sessionExpiresAt: state.sessionExpiresAt,
      }),
    }
  )
);
