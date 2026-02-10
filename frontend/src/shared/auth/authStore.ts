import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, User } from '@/shared/services/auth.service';
import { logger } from '@/shared/utils/logger';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => {
        logger.debug('AuthStore - setUser called with:', user);
        set({ user, isAuthenticated: !!user, isLoading: false });
      },

      getToken: () => get().token ?? null,

      login: async (username, password) => {
        logger.debug('AuthStore - login started');
        try {
          const response = await authService.login({ username, password });
          logger.debug('AuthStore - login response:', response);
          const token = (response as { token?: string }).token ?? null;
          set({ user: response.user, token, isAuthenticated: true, isLoading: false });
          logger.debug('AuthStore - state after login:', get());
        } catch (error) {
          logger.error('AuthStore - login error:', error);
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        logger.debug('AuthStore - logout');
        try {
          await authService.logout();
        } finally {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },

      checkAuth: async () => {
        const state = get();
        // If we already have user data from persisted state, trust it
        // The ProtectedRoute components will handle validation on navigation
        if (state.user && state.isAuthenticated) {
          logger.debug('AuthStore - Using persisted auth state for user:', state.user.username);
          set({ isLoading: false });
          return;
        }
        
        // Only check with server if we don't have persisted state
        logger.debug('AuthStore - No persisted auth, checking with server');
        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser();
          logger.debug('AuthStore - user fetched from server:', user);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          logger.error('AuthStore - checkAuth error:', error);
          logger.error('AuthStore - Error details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          });
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },

      refreshUser: async () => {
        logger.debug('AuthStore - refreshUser: Fetching fresh user data from server');
        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser();
          logger.debug('AuthStore - refreshUser: Fresh user data received:', user);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          logger.error('AuthStore - refreshUser error:', error);
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
